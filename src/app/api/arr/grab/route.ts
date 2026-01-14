import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ForumService } from '@/lib/services/forum';
import { JDownloaderLocalService, JDownloaderService } from '@/lib/services/jdownloader';
import { logger } from '@/lib/logger';
import * as cheerio from 'cheerio';

// Extract download links from HTML using hosting-specific patterns
// This matches the logic from /api/testing/extract-links to ensure consistency
function extractDownloadLinksFromHtml(html: string): string[] {
    const links: string[] = [];

    // Common download hosting patterns (same as testing endpoint)
    const hostingPatterns = [
        { name: 'Mega', regex: /https?:\/\/mega\.nz\/[^\s"'<>]*/gi },
        { name: '1fichier', regex: /https?:\/\/1fichier\.com\/[^\s"'<>]*/gi },
        { name: 'Uploaded', regex: /https?:\/\/uploaded\.net\/[^\s"'<>]*/gi },
        { name: 'Rapidgator', regex: /https?:\/\/rapidgator\.net\/[^\s"'<>]*/gi },
        { name: 'Nitroflare', regex: /https?:\/\/nitroflare\.com\/[^\s"'<>]*/gi },
        { name: 'Turbobit', regex: /https?:\/\/turbobit\.net\/[^\s"'<>]*/gi },
        { name: 'Mediafire', regex: /https?:\/\/(?:www\.)?mediafire\.com\/[^\s"'<>]*/gi },
        { name: 'Uptobox', regex: /https?:\/\/uptobox\.com\/[^\s"'<>]*/gi },
        { name: 'Katfile', regex: /https?:\/\/katfile\.com\/[^\s"'<>]*/gi },
        { name: 'Filefactory', regex: /https?:\/\/filefactory\.com\/[^\s"'<>]*/gi },
    ];

    // Extract links for each hosting service
    for (const pattern of hostingPatterns) {
        let match;
        while ((match = pattern.regex.exec(html)) !== null) {
            const url = match[0];
            if (!links.includes(url)) {
                links.push(url);
            }
        }
    }

    // Also look for generic download links (http/https followed by common extensions)
    const genericLinkRegex = /https?:\/\/[^\s"'<>]+\.(rar|zip|7z|mkv|mp4|avi|iso|exe|pdf)/gi;
    let match;
    while ((match = genericLinkRegex.exec(html)) !== null) {
        const url = match[0];
        if (!links.includes(url)) {
            links.push(url);
        }
    }

    return links;
}

function detectArrService(userAgent: string | null): string {
    if (!userAgent) return 'unknown';
    const ua = userAgent.toLowerCase();
    if (ua.includes('sonarr')) return 'sonarr';
    if (ua.includes('radarr')) return 'radarr';
    if (ua.includes('lidarr')) return 'lidarr';
    if (ua.includes('readarr')) return 'readarr';
    if (ua.includes('prowlarr')) return 'prowlarr';
    if (ua.includes('whisparr')) return 'whisparr';
    return 'unknown';
}

// GET /api/arr/grab - Download link grab endpoint (Newznab-compatible)
// Uses forum's API key (torznabApiKey field) for validation
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const apiKey = searchParams.get('apikey') || request.headers.get('x-api-key');
        const arrType = detectArrService(request.headers.get('user-agent'));
        // Newznab clients typically send t=get&id=<guid>; support both 'id' and 'guid'
        const guid = searchParams.get('id') || searchParams.get('guid'); // format: base64url(JSON{forumId, category, url})

        if (!apiKey || !guid) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key or GUID"/>`,
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Validate API key against forum's stored API key (torznabApiKey)
        const forumWithApiKey = await db.forum.findFirst({
            where: { torznabApiKey: apiKey },
        });

        if (!forumWithApiKey || !forumWithApiKey.enabled) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Parse GUID (base64url encoded JSON)
        let forumId: string;
        let postUrl: string;
        let category: string | undefined;

        try {
            const decoded = Buffer.from(guid, 'base64url').toString('utf-8');
            const guidData = JSON.parse(decoded);
            forumId = guidData.forumId;
            postUrl = guidData.url;
            category = typeof guidData.category === 'string' ? guidData.category : undefined;
        } catch (parseError) {
            // Fallback: try old format (forumId-category-url) for backwards compatibility
            const parts = guid.split('-');
            if (parts.length < 3) {
                return new NextResponse(
                    `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Invalid GUID format"/>`,
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/xml' },
                    }
                );
            }
            forumId = parts[0];
            category = parts[1];
            postUrl = parts.slice(2).join('-'); // Skip category at index 1
        }

        if (!forumId || !postUrl) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Invalid GUID format"/>`,
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Get forum and JDownloader config
        const forum = await db.forum.findUnique({
            where: { id: forumId },
            include: { credentials: true },
        });

        const jdConfig = await db.jDownloaderConfig.findFirst({ where: { enabled: true } });

        if (!forum || !jdConfig) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Forum or JDownloader not configured"/>`,
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Initialize services
        const forumService = new ForumService();

        const jdMode = (jdConfig.mode || 'local').toLowerCase();
        const jdLocal = jdMode === 'local'
            ? new JDownloaderLocalService(jdConfig.localHost || 'localhost', jdConfig.localPort || 3128)
            : null;
        const jdRemote = jdMode === 'cloud'
            ? new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName)
            : null;

        // Add forum to service
        forumService.addForum({
            id: forum.id,
            name: forum.name,
            baseUrl: forum.baseUrl,
            searchPath: forum.searchPath,
            searchMode: (forum.searchMode as any) || undefined,
            searchForumLabel: forum.searchForumLabel || undefined,
            cseId: forum.cseId || undefined,
            persistentCookies: forum.persistentCookies || undefined,
            thankButtonSelector: forum.thankButtonSelector || undefined,
            linksContainerSelector: forum.linksContainerSelector || undefined,
            postTitleSelector: forum.postTitleSelector || undefined,
            credentials: forum.credentials ? {
                username: forum.credentials.username,
                password: forum.credentials.password,
            } : undefined,
        });

        // Authenticate with forum if needed
        if (forum.credentials) {
            const authSuccess = await forumService.authenticate(forum.id);
            if (!authSuccess) {
                return new NextResponse(
                    `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Forum authentication failed"/>`,
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/xml' },
                    }
                );
            }
        }

        // Parse post to extract links. If links are hidden behind a "Thanks" gate,
        // click the thank button and re-parse. Even if we found a link before clicking,
        // the full set of hosters may only be visible after thanking.
        let html = await forumService.fetchPostHtml(forum.id, postUrl);
        let links = extractDownloadLinksFromHtml(html);
        
        if (links.length === 0) {
            // Check if thank button exists
            const thankSelector = forum.thankButtonSelector
                || '.thank-button, .thanks-btn, button[title*="thank" i], a[href*="post_thanks" i], a[href*="do=thank" i], a[href*="thanks" i]';
            const $ = cheerio.load(html);
            const thankRequired = $(thankSelector).length > 0;
            
            if (thankRequired) {
                // Click thank button and refetch
                await forumService.clickThankButton(forum.id, postUrl);
                html = await forumService.fetchPostHtml(forum.id, postUrl);
                links = extractDownloadLinksFromHtml(html);
            }
        }

        if (links.length === 0) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="No download links found"/>`,
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        const packageName = (() => {
            const $ = cheerio.load(html);
            return $(forum.postTitleSelector || '.post-title, .topic-title, h1, h2').first().text().trim() || 'Download';
        })();

        logger.info('arr_grab', 'ARR grab extracted links', {
            forumId: forum.id,
            forumName: forum.name,
            postUrl,
            linksCount: links.length,
            sampleLinks: links.slice(0, 5),
            hosts: Array.from(
                new Set(
                    links
                        .map((l) => {
                            try {
                                return new URL(l).host;
                            } catch {
                                return null;
                            }
                        })
                        .filter(Boolean) as string[]
                )
            ).slice(0, 20),
        });

        // Send links to JDownloader and start downloads automatically
        let jdSuccess = false;
        if (jdLocal) {
            jdSuccess = await jdLocal.addLinks(links, packageName, true, false);
        } else if (jdRemote) {
            const jdAuthSuccess = await jdRemote.authenticate();
            if (!jdAuthSuccess) {
                return new NextResponse(
                    `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="JDownloader authentication failed"/>`,
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/xml' },
                    }
                );
            }

            jdSuccess = await jdRemote.addLinks(links, packageName, true, false);

            if (jdSuccess) {
                // Best-effort: move the created package from LinkGrabber to Downloads
                // and ensure the download controller is running.
                await jdRemote.moveLinkGrabberPackagesToDownloadsByName(packageName);
                await jdRemote.startDownloadController();
            }
        } else {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="JDownloader not configured"/>`,
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        if (!jdSuccess) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Failed to add links to JDownloader"/>`,
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Create download record with ARR context
        const download = await db.download.create({
            data: {
                title: packageName,
                sourceUrl: postUrl,
                forumName: forum.name,
                status: 'queued',
                progress: 0,
                arrType,
                grabId: guid,
                category: category || undefined,
                releaseTitle: packageName,
            },
        });

        // Return a minimal valid NZB so Newznab clients can treat this as a download.
        // The actual download is handled by Sweaterr via JDownloader.
        const nzb = `<?xml version="1.0" encoding="UTF-8"?>
<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">
    <head>
        <meta type="name">Sweaterr</meta>
        <meta type="comment">Direct download queued in JDownloader by Sweaterr</meta>
        <meta type="source">${forum.name}</meta>
        <meta type="guid">${guid}</meta>
        <meta type="url">${postUrl}</meta>
        <meta type="downloadId">${download.id}</meta>
    </head>
    <file poster="sweaterr" date="0" subject="${packageName.replace(/[\r\n]+/g, ' ')}">
        <groups>
            <group>alt.binaries.misc</group>
        </groups>
        <segments>
            <segment bytes="0" number="1">sweaterr@local</segment>
        </segments>
    </file>
</nzb>`;

        return new NextResponse(nzb, {
            status: 200,
            headers: { 'Content-Type': 'application/x-nzb' },
        });
    } catch (error) {
        console.error('Error in grab endpoint:', error);
        return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?>
<error code="900" description="Internal server error"/>`,
            {
                status: 500,
                headers: { 'Content-Type': 'application/xml' },
            }
        );
    }
}
