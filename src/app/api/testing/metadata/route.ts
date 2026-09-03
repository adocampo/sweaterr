import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import { sessionManager } from '@/lib/services/flaresolverr-session-manager';
import { logger } from '@/lib/logger';
import { verifyTokenEdge } from '@/lib/edge-jwt';
import axios from 'axios';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { getJarForHost, preloadJarCookies } from '@/lib/cookie-jar-store';
import { AIService, MediaMetadata } from '@/lib/services/ai';
import { isSeasonPack, detectType, extractYear } from '@/lib/metadata-extractor';
import { buildHeuristicMetadata, mergeMetadata, applyReference } from '@/lib/services/metadata-ai';
import { resolveTitleFactsBatch, resolveTitleFacts } from '@/lib/services/tmdb';

interface MetadataResult {
    url: string;
    rawTitle?: string;  // Original forum post title for verification
    metadata?: MediaMetadata;
    isSeasonPack?: boolean; // True if [X/Y] where X == Y
    error?: string;
}

const MAX_SNIPPET_CHARS = 1800;

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

export async function POST(request: NextRequest) {
    try {
        const { forumId, postUrls, searchQuery, directTitles, useAI } = await request.json();

        // Modo directo: parsear títulos sin fetch (búsqueda nativa)
        if (directTitles && Array.isArray(directTitles) && directTitles.length > 0) {
            const results: MetadataResult[] = [];

            const directForum = forumId
                ? await db.forum.findUnique({ where: { id: forumId }, select: { defaultLanguage: true } })
                : null;
            const forumLanguage = directForum?.defaultLanguage || 'es-ES';

            // External facts are independent from AI: they fill year, genres and the language behind "Dual".
            const tmdbFailures: string[] = [];
            const references = await resolveTitleFactsBatch(
                directTitles
                    .filter((item: any) => item?.title)
                    .map((item: any) => ({
                        key: String(item.url || item.title),
                        title: item.title,
                        type: detectType(item.title, ''),
                        year: extractYear(item.title),
                    })),
                forumLanguage,
                (message) => tmdbFailures.push(message)
            );

            // AI provider (first enabled)
            let aiService: AIService | null = null;
            const aiProvider = useAI
                ? await db.aIConfig.findFirst({ where: { enabled: true }, orderBy: { createdAt: 'desc' } })
                : null;
            if (aiProvider) {
                aiService = new AIService({
                    provider: aiProvider.provider,
                    apiKey: aiProvider.apiKey || undefined,
                    baseUrl: aiProvider.baseUrl || undefined,
                    model: aiProvider.model || undefined,
                });
            }

            for (const item of directTitles) {
                const { url, title, snippet } = item;
                if (!title) {
                    results.push({ url: url || '', error: 'Título vacío' });
                    continue;
                }

                const heuristic = buildHeuristicMetadata({
                    rawTitle: title,
                    breadcrumbs: '',
                    bodyText: snippet || '',
                    linksContainerText: '',
                    searchQuery,
                });

                const reference = references.get(String(url || title)) || null;

                let aiMetadata: MediaMetadata | null = null;
                if (aiService) {
                    try {
                        aiMetadata = await aiService.extractMediaMetadata({
                            title,
                            breadcrumbs: '',
                            contentSnippet: snippet || '',
                            searchQuery,
                            forumDefaultLanguage: forumLanguage,
                            reference,
                        });
                    } catch (err) {
                        logger.warn('metadata', `AI metadata failed: ${err}`);
                    }
                }

                const merged = applyReference(mergeMetadata(heuristic, aiMetadata), reference, {
                    rawTitle: title,
                    forumLanguage,
                });
                const seasonPack = isSeasonPack(title);
                results.push({ url: url || '', rawTitle: title, metadata: merged, isSeasonPack: seasonPack });
            }

            const totalErrors = results.filter((r) => r.error).length;
            const totalResolved = results.filter((r) => r.metadata).length;

            return NextResponse.json({
                success: true,
                data: {
                    forumId,
                    results,
                    totalErrors,
                    totalResolved,
                    totalResults: directTitles.length,
                    mode: 'direct',
                    tmdbWarning: tmdbFailures.length
                        ? `TMDB lookup failed: ${tmdbFailures[0]}. Check TMDB_API_KEY.`
                        : undefined,
                },
            });
        }

        // Modo legacy: fetch URLs
        if (!forumId || !Array.isArray(postUrls) || postUrls.length === 0) {
            return NextResponse.json(
                { success: false, error: 'forumId y postUrls (o directTitles) son requeridos' },
                { status: 400 }
            );
        }

        const forum = await db.forum.findUnique({ where: { id: forumId } });
        if (!forum) {
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        const parsedCookies = forum.persistentCookies ? JSON.parse(forum.persistentCookies) : [];
        const cookieArr: Array<{ name: string; value: string }> = Array.isArray(parsedCookies)
            ? parsedCookies
            : parsedCookies && typeof parsedCookies === 'object'
                ? Array.isArray((parsedCookies as any).cookies)
                    ? (parsedCookies as any).cookies
                    : []
                : [];
        const storedUserAgent: string | undefined =
            parsedCookies && typeof parsedCookies === 'object' && typeof (parsedCookies as any).userAgent === 'string'
                ? (parsedCookies as any).userAgent
                : undefined;

        const host = new URL(postUrls[0]).hostname;
        const jar: CookieJar = getJarForHost(host);
        if (cookieArr.length > 0) {
            await preloadJarCookies(jar, postUrls[0], cookieArr);
            logger.info('metadata', `Using CookieJar for ${host} with ${cookieArr.length} persisted cookies`);
        }

        let activeUserAgent = storedUserAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        const client = axiosCookieJarSupport(
            axios.create({
                jar,
                withCredentials: true,
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9',
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': activeUserAgent,
                    Referer: forum.baseUrl || `https://${host}/`,
                },
                timeout: 20000,
            })
        );

        const flaresolverrUrl = forum.useFlaresolverr ? process.env.FLARESOLVERR_URL : null;
        const fsClient = flaresolverrUrl ? new FlareSolverrClient(flaresolverrUrl) : null;
        let sessionId: string | undefined;
        let usedFlareSolverr = false;
        const results: MetadataResult[] = [];
        const tmdbFailures: string[] = [];

        // AI provider (first enabled)
        let aiService: AIService | null = null;
        const aiProvider = useAI
            ? await db.aIConfig.findFirst({ where: { enabled: true }, orderBy: { createdAt: 'desc' } })
            : null;
        if (aiProvider) {
            aiService = new AIService({
                provider: aiProvider.provider,
                apiKey: aiProvider.apiKey || undefined,
                baseUrl: aiProvider.baseUrl || undefined,
                model: aiProvider.model || undefined,
            });
        }

        const titleSelector = forum.postTitleSelector || '.threadtitle, #thread_title, .navbar strong, h1, h2';
        const linksContainerSelector = forum.linksContainerSelector;

        const tryAxios = async (url: string) => {
            const res = await client.get(url);
            const body = String(res.data || '');
            const looksLikeChallenge = res.status === 403 || body.includes('cf-mitigated') || body.includes('Just a moment');
            if (looksLikeChallenge) throw new Error('Cloudflare challenge');
            return body;
        };

        for (const postUrl of postUrls) {
            let html = '';

            try {
                if (!fsClient) {
                    html = await tryAxios(postUrl);
                } else {
                    if (!sessionId) {
                        const ttlMs = forum.flaresolverrSessionTTL || 30 * 60 * 1000;
                        sessionId = await sessionManager.getSession(forumId, host, ttlMs, fsClient);
                    }
                    usedFlareSolverr = true;
                    const solution = await fsClient.request(postUrl, 'GET', undefined, sessionId);
                    html = solution.response || '';

                    if (solution.cookies && solution.cookies.length > 0) {
                        await preloadJarCookies(jar, postUrl, solution.cookies);
                        if (solution.userAgent) {
                            activeUserAgent = solution.userAgent;
                            client.defaults.headers['User-Agent'] = solution.userAgent;
                        }
                    }
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                results.push({ url: postUrl, error: message });
                continue;
            }

            if (!html) {
                results.push({ url: postUrl, error: 'No se pudo obtener HTML del post' });
                continue;
            }

            const $ = cheerio.load(html);
            const rawTitle = normalizeWhitespace($(titleSelector).first().text().trim() || $('title').first().text().trim() || '');
            const breadcrumbSelectors = ['.breadcrumb', '.navbar', '#breadcrumb', '.page-breadcrumb'];
            const breadcrumbs = breadcrumbSelectors
                .map((sel) => normalizeWhitespace($(sel).text() || ''))
                .filter(Boolean)
                .join(' | ');
            const linksContainerText = linksContainerSelector ? normalizeWhitespace($(linksContainerSelector).text() || '') : '';
            const bodyText = normalizeWhitespace($('body').text().substring(0, MAX_SNIPPET_CHARS));

            // Extract the opening post (technical sheet, synopsis, MEDIAINFO block) so the AI
            // can fill any fields the deterministic pipeline + TMDB could not resolve.
            function extractFirstPostText(maxChars: number): string {
                const techMarker = /(datos\s+t[eé]cnicos|ficha\s+t[eé]cnica|mediainfo|subt[ií]tulos?\s*:|audio\s*(#\d+)?\s*:|idiomas?\s*:|calidad\s*:)/i;
                const selectors = [
                    '[id^="post_message_"]',
                    '.postcontent',
                    '.post_body',
                    '.message-body .bbWrapper',
                    'article .message-body',
                    '.postbody .content',
                    '.entry-content',
                ];
                for (const sel of selectors) {
                    const el = $(sel).first();
                    if (!el.length) continue;
                    el.find('br').replaceWith('\n');
                    el.find('p, div, li, tr, h1, h2, h3').append('\n');
                    const text = el.text().replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
                    if (text.length < 60) continue;
                    if (text.length > maxChars) {
                        const marker = text.search(techMarker);
                        if (marker !== -1) {
                            const start = Math.max(0, marker - 500);
                            return text.slice(start, start + maxChars);
                        }
                        return text.slice(0, maxChars);
                    }
                    return text;
                }
                // Fallback: full body
                return bodyText.substring(0, maxChars);
            }
            const firstPostText = extractFirstPostText(Number.POSITIVE_INFINITY);

            const heuristic = buildHeuristicMetadata({
                rawTitle,
                breadcrumbs,
                bodyText,
                linksContainerText,
                searchQuery,
            });

            const reference = await resolveTitleFacts(rawTitle, {
                type: detectType(rawTitle, breadcrumbs),
                year: extractYear(rawTitle),
                language: forum.defaultLanguage || 'es-ES',
                onFailure: (message) => tmdbFailures.push(message),
            });

            let aiMetadata: MediaMetadata | null = null;
            if (aiService) {
                try {
                    aiMetadata = await aiService.extractMediaMetadata({
                        title: rawTitle,
                        breadcrumbs,
                        contentSnippet: bodyText.substring(0, MAX_SNIPPET_CHARS),
                        postText: firstPostText || undefined,
                        searchQuery,
                        forumDefaultLanguage: forum.defaultLanguage || undefined,
                        reference,
                    });
                    logger.info('metadata', `AI called with postText: ${firstPostText ? firstPostText.length : 0} chars`);
                } catch (err) {
                    logger.warn('metadata', `AI metadata failed: ${err}`);
                }
            }

            const merged = applyReference(mergeMetadata(heuristic, aiMetadata), reference, {
                rawTitle,
                forumLanguage: forum.defaultLanguage || 'es-ES',
            });
            const seasonPack = isSeasonPack(rawTitle);
            results.push({ url: postUrl, rawTitle, metadata: merged, isSeasonPack: seasonPack });
        }

        // Persist cookies if we used FlareSolverr
        if (usedFlareSolverr) {
            try {
                const finalCookies = await jar.getCookies(postUrls[0]);
                const merged = finalCookies.map((c) => ({ name: c.key, value: c.value }));
                const toPersist: any = { cookies: merged, userAgent: activeUserAgent };
                await db.forum.update({
                    where: { id: forum.id },
                    data: {
                        persistentCookies: JSON.stringify(toPersist),
                        cookiesUpdatedAt: new Date(),
                    },
                });
                logger.info('metadata', `Persisted ${merged.length} cookies after FlareSolverr`);
            } catch (err) {
                logger.warn('metadata', `Failed to persist cookies: ${err}`);
            }
        }

        const totalErrors = results.filter((r) => r.error).length;
        const totalResolved = results.filter((r) => r.metadata).length;

        return NextResponse.json({
            success: true,
            data: {
                forumId,
                results,
                totalErrors,
                totalResolved,
                totalResults: postUrls.length,
                mode: 'fetch',
                tmdbWarning: tmdbFailures.length
                    ? `TMDB lookup failed: ${tmdbFailures[0]}. Check TMDB_API_KEY.`
                    : undefined,
            },
        });
    } catch (error) {
        logger.error('metadata', `Error: ${error instanceof Error ? error.message : String(error)}`);
        return NextResponse.json(
            { success: false, error: 'Error al obtener metadatos' },
            { status: 500 }
        );
    }
}
