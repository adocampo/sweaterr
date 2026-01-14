import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ForumService } from '@/lib/services/forum';
import { JDownloaderLocalService, JDownloaderService } from '@/lib/services/jdownloader';
import { logger } from '@/lib/logger';
import axios from 'axios';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import { getJarForHost, preloadJarCookies } from '@/lib/cookie-jar-store';
import { extractDownloadLinksFromHtml } from '@/lib/services/link-extractor';

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

        // Initialize JDownloader service
        const jdMode = (jdConfig.mode || 'local').toLowerCase();
        const jdLocal = jdMode === 'local'
            ? new JDownloaderLocalService(jdConfig.localHost || 'localhost', jdConfig.localPort || 3128)
            : null;
        const jdRemote = jdMode === 'cloud'
            ? new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName)
            : null;

        // Parse post to extract links using the SAME logic as testing endpoint
        // We replicate the logic directly here instead of calling via HTTP to avoid concurrency issues
        let links: string[] = [];
        let clickedThanks = false;
        
        try {
            const host = new URL(postUrl).hostname;
            const jar: CookieJar = getJarForHost(host);
            const parsedCookies = forum.persistentCookies ? JSON.parse(forum.persistentCookies) : [];
            const cookieArr: Array<{ name: string; value: string; domain?: string; path?: string }> = Array.isArray(parsedCookies)
                ? parsedCookies
                : parsedCookies && typeof parsedCookies === 'object'
                    ? Array.isArray((parsedCookies as any).cookies) ? (parsedCookies as any).cookies : []
                    : [];
            const storedUserAgent: string | undefined = parsedCookies && typeof parsedCookies === 'object' && typeof (parsedCookies as any).userAgent === 'string'
                ? (parsedCookies as any).userAgent
                : undefined;

            if (cookieArr.length > 0) {
                await preloadJarCookies(jar, postUrl, cookieArr);
            }

            const axiosClient = axiosCookieJarSupport(axios.create({
                jar,
                withCredentials: true,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': storedUserAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': forum.baseUrl || `https://${host}/`,
                },
                timeout: 20000,
            }));

            const flaresolverrUrl = process.env.FLARESOLVERR_URL;
            const fsClient = flaresolverrUrl ? new FlareSolverrClient(flaresolverrUrl) : null;

            const useFlareSolverr = async (url: string) => {
                if (!fsClient) {
                    throw new Error('FlareSolverr no configurado');
                }
                const solution = await fsClient.request(url, 'GET');
                const solvedCookies = solution.cookies || [];
                if (solvedCookies.length > 0) {
                    await preloadJarCookies(jar, url, solvedCookies);
                    const mergedByName = new Map<string, string>();
                    for (const c of cookieArr) mergedByName.set(c.name, c.value);
                    for (const c of solvedCookies) mergedByName.set(c.name, c.value);
                    const merged = Array.from(mergedByName.entries()).map(([name, value]) => ({ name, value }));
                    const toPersist: any = { cookies: merged, userAgent: solution.userAgent || storedUserAgent };
                    await db.forum.update({
                        where: { id: forum.id },
                        data: { persistentCookies: JSON.stringify(toPersist), cookiesUpdatedAt: new Date() },
                    });
                }
                return solution.response || '';
            };

            const tryAxios = async (url: string) => {
                const res = await axiosClient.get(url);
                const body = String(res.data || '');
                const looksLikeChallenge = res.status === 403 || body.includes('cf-mitigated') || body.includes('Just a moment');
                if (looksLikeChallenge) {
                    throw Object.assign(new Error('Cloudflare challenge'), { response: { status: res.status } });
                }
                return body;
            };

            console.log('[ARR/Grab] Fetching post:', postUrl);

            let html = '';
            try {
                html = await tryAxios(postUrl);
                console.log('[ARR/Grab] ✓ Axios succeeded for post');
            } catch (firstErr: any) {
                const status = firstErr?.response?.status;
                console.log(`[ARR/Grab] ✗ Axios failed (status ${status}). Trying FlareSolverr...`);
                html = await useFlareSolverr(postUrl);
                try {
                    html = await tryAxios(postUrl);
                    console.log('[ARR/Grab] ✓ Axios succeeded after FlareSolverr');
                } catch {
                    console.log('[ARR/Grab] Using FlareSolverr HTML response');
                }
            }

            // Check if we need to click "Thanks" button
            const thanksLinkRegex = /thanks\.php\?do=post&(?:amp;)?postid=(\d+)/i;
            const thanksMatch = html.match(thanksLinkRegex);

            if (thanksMatch) {
                const thanksUrl = thanksMatch[0].startsWith('http')
                    ? thanksMatch[0]
                    : `${forum.baseUrl}/${thanksMatch[0]}`;

                console.log('[ARR/Grab] Found thanks link, clicking:', thanksUrl);

                try {
                    await tryAxios(thanksUrl);
                } catch (err: any) {
                    console.log('[ARR/Grab] Axios thanks failed, using FlareSolverr');
                    await useFlareSolverr(thanksUrl);
                }

                // Refetch the post to reveal links
                try {
                    html = await tryAxios(postUrl);
                    console.log('[ARR/Grab] ✓ Axios refetch after thanks');
                } catch {
                    html = await useFlareSolverr(postUrl);
                    console.log('[ARR/Grab] Using FlareSolverr HTML after thanks');
                }

                clickedThanks = true;
            }

            // Extract download links using shared logic
            const extractedLinks = extractDownloadLinksFromHtml(html, forum.baseUrl);
            links = extractedLinks.map(l => l.url);

            console.log('[ARR/Grab] Extracted', links.length, 'links');

        } catch (extractErr) {
            logger.warn('arr_grab', 'Failed to extract links:', extractErr);
            console.log('[ARR/Grab] Link extraction error:', extractErr);
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

        // Get package name from extracted data
        let packageName = forum.name || 'Download';
        
        // Try to get filename from first link's extracted info
        let html_for_title = '';
        try {
            // Attempt to extract title from HTML (was stored in last extraction)
            const titleMatch = html_for_title ? /<title[^>]*>([^<]+)<\/title>/i.exec(html_for_title) : null;
            if (titleMatch) {
                packageName = titleMatch[1].trim();
            }
        } catch (e) {
            // Fall back to forum name if title extraction fails
        }

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
