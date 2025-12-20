import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';

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

        const flaresolverrUrl = process.env.FLARESOLVERR_URL;

        if (!flaresolverrUrl) {
            return NextResponse.json(
                { success: false, error: 'FlareSolverr no configurado' },
                { status: 500 }
            );
        }

        const client = new FlareSolverrClient(flaresolverrUrl);

        console.log('[Testing/ExtractLinks] Fetching post:', postUrl);

        // Step 1: Get the post page
        let solution = await client.request(postUrl, 'GET');
        let html = solution.response || '';

        // Step 2: Check if we need to click "Thanks" button
        // The button might be a link like: thanks.php?do=post&postid=12345
        const thanksLinkRegex = /thanks\.php\?do=post&(?:amp;)?postid=(\d+)/i;
        const thanksMatch = html.match(thanksLinkRegex);

        if (thanksMatch) {
            const thanksUrl = thanksMatch[0].startsWith('http')
                ? thanksMatch[0]
                : `${forum.baseUrl}/${thanksMatch[0]}`;

            console.log('[Testing/ExtractLinks] Found thanks link, clicking:', thanksUrl);

            // Click the thanks button (GET request)
            solution = await client.request(thanksUrl, 'GET');

            // After clicking thanks, we might be redirected back to the post
            // Or we might need to fetch the post again to see revealed links
            if (solution.url !== postUrl) {
                console.log('[Testing/ExtractLinks] Refetching post after thanks');
                solution = await client.request(postUrl, 'GET');
            }

            html = solution.response || '';
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
