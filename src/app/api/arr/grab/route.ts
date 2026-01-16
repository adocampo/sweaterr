import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JDownloaderLocalService, JDownloaderService } from '@/lib/services/jdownloader';
import { logger } from '@/lib/logger';
import { extractLinksFromPost } from '@/lib/services/link-extractor';

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
        let title: string | undefined;

        try {
            const decoded = Buffer.from(guid, 'base64url').toString('utf-8');
            const guidData = JSON.parse(decoded);
            forumId = guidData.forumId;
            postUrl = guidData.url;
            category = typeof guidData.category === 'string' ? guidData.category : undefined;
            title = typeof guidData.title === 'string' ? guidData.title : undefined;
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

        logger.info('arr_grab', `Grab requested for forum=${forum.name}, postUrl=${postUrl}, arrType=${arrType}`);

        // Use EXACT SAME function as testing /api/extract-links endpoint
        const extractResult = await extractLinksFromPost(
            postUrl,
            forum.baseUrl,
            forum.credentials?.username,
            forum.credentials?.password,
            process.env.FLARESOLVERR_URL,
            forumId,
            {
                thankButtonSelector: forum.thankButtonSelector || undefined,
                linksContainerSelector: forum.linksContainerSelector || undefined,
            }
        );

        if (!extractResult.success) {
            logger.warn('arr_grab', `Link extraction failed: ${extractResult.error}`);
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Failed to extract links: ${extractResult.error}"/>`,
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        const links = extractResult.links || [];

        if (links.length === 0) {
            logger.warn('arr_grab', 'No download links found in post');
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="No download links found"/>`,
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        logger.info('arr_grab', `Extracted ${links.length} links from post`);

        // Initialize JDownloader service
        const jdMode = (jdConfig.mode || 'local').toLowerCase();
        const jdLocal = jdMode === 'local'
            ? new JDownloaderLocalService(jdConfig.localHost || 'localhost', jdConfig.localPort || 3128)
            : null;
        const jdRemote = jdMode === 'cloud'
            ? new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName)
            : null;

        // Get package name (use title from GUID, fallback to forum name)
        const packageName = title || forum.name || 'Download';

        logger.info('arr_grab', 'Sending links to JDownloader', {
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
                logger.error('arr_grab', 'JDownloader authentication failed');
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
            logger.error('arr_grab', 'JDownloader not configured');
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
            logger.error('arr_grab', 'Failed to add links to JDownloader');
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Failed to add links to JDownloader"/>`,
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        logger.info('arr_grab', 'Links successfully added to JDownloader');

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

        // Escape XML special characters
        const escapeXml = (value: string) => 
            value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

        // Return a minimal valid NZB so Newznab clients can treat this as a download.
        // The actual download is handled by Sweaterr via JDownloader.
        const nzb = `<?xml version="1.0" encoding="UTF-8"?>
<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">
    <head>
        <meta type="name">Sweaterr</meta>
        <meta type="comment">Direct download queued in JDownloader by Sweaterr</meta>
        <meta type="source">${escapeXml(forum.name)}</meta>
        <meta type="guid">${escapeXml(guid)}</meta>
        <meta type="url">${escapeXml(postUrl)}</meta>
        <meta type="downloadId">${escapeXml(download.id)}</meta>
    </head>
    <file poster="sweaterr" date="0" subject="${escapeXml(packageName.replace(/[\r\n]+/g, ' '))}">
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
        logger.error('arr_grab', 'Error in grab endpoint', error);
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
