import { NextRequest, NextResponse } from 'next/server';
import cheerio from 'cheerio';
import { db } from '@/lib/db';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';

interface SearchResult {
    title: string;
    url: string;
    snippet?: string;
    date?: string;
}

export async function POST(request: NextRequest) {
    try {
        const { forumId, query } = await request.json();

        if (!forumId || !query) {
            return NextResponse.json(
                { success: false, error: 'forumId y query son requeridos' },
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
        let results: SearchResult[] = [];

        // Determine search method based on forum searchMode
        const searchMode = (forum as any).searchMode || 'google_site';

        if (searchMode === 'native' && forum.searchPath) {
            // Native forum search using FlareSolverr
            if (!flaresolverrUrl) {
                return NextResponse.json(
                    { success: false, error: 'FlareSolverr no configurado para búsqueda nativa' },
                    { status: 500 }
                );
            }

            const client = new FlareSolverrClient(flaresolverrUrl);
            const searchUrl = `${forum.baseUrl}${forum.searchPath}?do=process&query=${encodeURIComponent(query)}`;

            console.log('[Testing/Search] Native search:', searchUrl);

            try {
                const solution = await client.request(searchUrl, 'GET');

                // Parse HTML to extract search results
                // This is a basic example - you'll need to adapt selectors based on actual forum HTML
                const html = solution.response || '';
                results = parseSearchResults(html, forum.baseUrl);

            } catch (err) {
                console.error('[Testing/Search] FlareSolverr error:', err);
                return NextResponse.json(
                    { success: false, error: 'Error al ejecutar búsqueda en foro' },
                    { status: 500 }
                );
            }

        } else if (searchMode === 'google_site') {
            // Google site: search
            const googleQuery = `site:${new URL(forum.baseUrl).hostname} ${query}`;
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;

            console.log('[Testing/Search] Google site search:', googleUrl);

            // For Google search, we can't use FlareSolverr as Google blocks automated tools
            // Instead, we'll return mock results or suggest manual search
            results = [{
                title: 'Google Search (manual)',
                url: googleUrl,
                snippet: `Abre este enlace en tu navegador para buscar: "${googleQuery}"`,
            }];

        } else if (searchMode === 'google_cse' && (forum as any).cseId) {
            // Google Custom Search Engine (requires JavaScript execution to render)
            const cseId = (forum as any).cseId;
            const cseUrl = `https://cse.google.com/cse?cx=${cseId}&q=${encodeURIComponent(query)}`;

            console.log('[Testing/Search] Google CSE URL:', cseUrl);

            if (!flaresolverrUrl) {
                // Without FlareSolverr, can't render JS, return manual link
                results = [{
                    title: 'Ver resultados en Google CSE',
                    url: cseUrl,
                    snippet: `FlareSolverr no configurado. Abre el enlace en tu navegador para buscar: "${query}"`,
                }];
                console.log('[Testing/Search] CSE: FlareSolverr not configured, returning manual link');
            } else {
                try {
                    const client = new FlareSolverrClient(flaresolverrUrl);
                    const solution = await client.request(cseUrl, 'GET');
                    const html = solution.response || '';

                    if (!html || html.length < 100) {
                        console.log('[Testing/Search] CSE: received empty or minimal HTML, returning manual link');
                        results = [{
                            title: 'Ver resultados en Google CSE',
                            url: cseUrl,
                            snippet: `No se obtuvieron resultados. Abre el enlace para buscar: "${query}"`,
                        }];
                    } else {
                        results = parseGoogleCSEResults(html, forum.baseUrl, query);
                        console.log(`[Testing/Search] CSE via FlareSolverr: ${results.length} results found`);

                        if (results.length === 0) {
                            results = [{
                                title: 'Ver resultados en Google CSE',
                                url: cseUrl,
                                snippet: `No se pudieron parsear resultados. Abre el enlace: "${query}"`,
                            }];
                        }
                    }
                } catch (err) {
                    console.error('[Testing/Search] CSE FlareSolverr error:', err);
                    results = [{
                        title: 'Ver resultados en Google CSE',
                        url: cseUrl,
                        snippet: `Error al obtener resultados. Abre el enlace para buscar: "${query}"`,
                    }];
                }
            }
        }

        return NextResponse.json({
            success: true,
            results,
            searchMode,
            forum: {
                id: forum.id,
                name: forum.name,
            },
        });

    } catch (error) {
        console.error('[Testing/Search] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// Helper function to parse Google CSE results HTML
function parseGoogleCSEResults(html: string, baseUrl: string, _query: string): SearchResult[] {
    const host = new URL(baseUrl).hostname.replace(/^www\./, '');
    const seen = new Set<string>();
    const out: SearchResult[] = [];

    // 1) Extract ALL showthread anchors from the same domain
    const showthreadRe = /<a[^>]*href=["']([^"']*showthread[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;

    while ((m = showthreadRe.exec(html)) !== null) {
        let url = m[1];

        // Exclude print/forum listing variants
        if (/printthread|printhread|forumdisplay/i.test(url)) continue;

        // Normalize different URL forms to absolute on the forum origin
        const origin = new URL(baseUrl).origin;
        if (url.startsWith('//')) {
            url = `https:${url}`;
        } else if (url.startsWith('http')) {
            try {
                const u = new URL(url);
                if (u.hostname.replace(/^www\./, '') !== host) continue; // off-domain absolute URL
            } catch { }
        } else if (url.startsWith('/')) {
            url = `${origin}${url}`;
        } else if (url.startsWith('showthread')) {
            url = `${origin}/${url}`;
        }

        // Deduplicate by normalized URL
        if (seen.has(url)) continue;
        seen.add(url);

        // Extract title: prefer title attribute, fallback to inner text
        const anchorHtml = m[0];
        const titleAttrMatch = anchorHtml.match(/\btitle=["']([\s\S]*?)["']/i);
        let titleCandidate = titleAttrMatch ? titleAttrMatch[1] : m[2];

        // Strip HTML tags and normalize whitespace
        const titleRaw = titleCandidate.replace(/<[^>]+>/g, ' ');
        const title = titleRaw.replace(/\s+/g, ' ').trim();

        // Only skip if title is truly empty
        if (title.length === 0) continue;

        out.push({ title, url });
    }

    // Return all results, capped at 10
    return out.slice(0, 10);
}

// Helper function to parse HTML search results
// This is a basic implementation - adapt selectors based on actual forum structure
function parseSearchResults(html: string, baseUrl: string): SearchResult[] {
    const results: SearchResult[] = [];

    // Simple regex-based parsing (for production, use a proper HTML parser like cheerio)
    // Looking for patterns like: <a href="/showthread.php?t=12345">Title</a>

    const titleRegex = /<a[^>]*href=["']([^"']*showthread[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = titleRegex.exec(html)) !== null) {
        const [, urlPath, title] = match;
        const fullUrl = urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;

        results.push({
            title: title.trim(),
            url: fullUrl,
        });

        // Limit results to avoid too much data
        if (results.length >= 20) break;
    }

    return results;
}
