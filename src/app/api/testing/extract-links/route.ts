import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { db } from '@/lib/db';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import { getJarForHost, preloadJarCookies } from '@/lib/cookie-jar-store';

interface ExtractedLink {
    url: string;
    hosting: string;
    filename?: string;
}

export async function POST(request: NextRequest) {
    try {
        const { forumId, postUrl } = await request.json();

        if (!forumId || !postUrl) {
            return NextResponse.json(
                { success: false, error: 'forumId y postUrl son requeridos' },
                { status: 400 }
            );
        }

        // Get forum config
        const forum = await db.forum.findUnique({
            where: { id: forumId },
            include: { credentials: true },
        });

        if (!forum) {
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        const parsedCookies = forum.persistentCookies ? JSON.parse(forum.persistentCookies) : [];
        const cookieArr: Array<{ name: string; value: string; domain?: string; path?: string }> = Array.isArray(parsedCookies)
            ? parsedCookies
            : parsedCookies && typeof parsedCookies === 'object'
                ? Array.isArray((parsedCookies as any).cookies) ? (parsedCookies as any).cookies : []
                : [];
        const storedUserAgent: string | undefined = parsedCookies && typeof parsedCookies === 'object' && typeof (parsedCookies as any).userAgent === 'string'
            ? (parsedCookies as any).userAgent
            : undefined;

        const host = new URL(postUrl).hostname;
        const jar: CookieJar = getJarForHost(host);
        if (cookieArr.length > 0) {
            await preloadJarCookies(jar, postUrl, cookieArr);
            console.log(`[Testing/ExtractLinks] Using CookieJar for ${host} with ${cookieArr.length} persisted cookies`);
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
                console.log(`[Testing/ExtractLinks] Persisted ${merged.length} cookies after FlareSolverr`);
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

        console.log('[Testing/ExtractLinks] Fetching post:', postUrl);

        let html = '';
        try {
            html = await tryAxios(postUrl);
            console.log('[Testing/ExtractLinks] ✓ Axios succeeded for post');
        } catch (firstErr: any) {
            const status = firstErr?.response?.status;
            console.log(`[Testing/ExtractLinks] ✗ Axios failed (status ${status}). Trying FlareSolverr...`);
            html = await useFlareSolverr(postUrl);
            // Try again with axios for consistent parsing; fallback to solver HTML if still blocked
            try {
                html = await tryAxios(postUrl);
                console.log('[Testing/ExtractLinks] ✓ Axios succeeded after FlareSolverr');
            } catch {
                console.log('[Testing/ExtractLinks] Using FlareSolverr HTML response');
            }
        }

        // Step 2: Check if we need to click "Thanks" button
        const thanksLinkRegex = /thanks\.php\?do=post&(?:amp;)?postid=(\d+)/i;
        const thanksMatch = html.match(thanksLinkRegex);

        if (thanksMatch) {
            const thanksUrl = thanksMatch[0].startsWith('http')
                ? thanksMatch[0]
                : `${forum.baseUrl}/${thanksMatch[0]}`;

            console.log('[Testing/ExtractLinks] Found thanks link, clicking:', thanksUrl);

            try {
                await tryAxios(thanksUrl);
            } catch (err: any) {
                console.log('[Testing/ExtractLinks] Axios thanks failed, using FlareSolverr');
                await useFlareSolverr(thanksUrl);
            }

            // Refetch the post to reveal links
            try {
                html = await tryAxios(postUrl);
                console.log('[Testing/ExtractLinks] ✓ Axios refetch after thanks');
            } catch {
                html = await useFlareSolverr(postUrl);
                console.log('[Testing/ExtractLinks] Using FlareSolverr HTML after thanks');
            }
        }

        // Step 3: Extract download links
        const links = extractDownloadLinks(html, forum.baseUrl);

        console.log('[Testing/ExtractLinks] Extracted', links.length, 'links');

        return NextResponse.json({
            success: true,
            links,
            clickedThanks: !!thanksMatch,
            postUrl,
        });

    } catch (error) {
        console.error('[Testing/ExtractLinks] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al extraer enlaces' },
            { status: 500 }
        );
    }
}

// Helper function to extract download links and categorize by hosting
function extractDownloadLinks(html: string, baseUrl: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];

    // Common download hosting patterns
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

            // Skip if already added
            if (links.some(l => l.url === url)) continue;

            // Try to extract filename from URL
            const filename = extractFilenameFromUrl(url);

            links.push({
                url,
                hosting: pattern.name,
                filename,
            });
        }
    }

    // Also look for generic download links (http/https followed by common extensions)
    const genericLinkRegex = /https?:\/\/[^\s"'<>]+\.(rar|zip|7z|mkv|mp4|avi|iso|exe|pdf)/gi;
    let match;
    while ((match = genericLinkRegex.exec(html)) !== null) {
        const url = match[0];

        // Skip if already added
        if (links.some(l => l.url === url)) continue;

        // Determine hosting from domain
        const domain = new URL(url).hostname.replace('www.', '');
        const hosting = domain.split('.')[0];

        links.push({
            url,
            hosting: hosting.charAt(0).toUpperCase() + hosting.slice(1),
            filename: extractFilenameFromUrl(url),
        });
    }

    return links;
}

function extractFilenameFromUrl(url: string): string | undefined {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop();

        if (filename && filename.includes('.')) {
            return decodeURIComponent(filename);
        }
    } catch (err) {
        // Invalid URL, ignore
    }

    return undefined;
}
