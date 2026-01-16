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
import { 
  detectSeriesByEpisodePattern,
  detectType,
  extractYear,
  extractSeason,
  extractQuality,
  extractLanguages,
  extractEpisodes,
  extractCleanTitle,
  extractSize,
} from '@/lib/metadata-extractor';

interface MetadataResult {
    url: string;
    rawTitle?: string;  // Original forum post title for verification
    metadata?: MediaMetadata;
    error?: string;
}

const MAX_SNIPPET_CHARS = 1800;

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function buildHeuristicMetadata(params: {
    rawTitle: string;
    breadcrumbs: string;
    bodyText: string;
    linksContainerText?: string;
    searchQuery?: string;
}): MediaMetadata {
    const { rawTitle, breadcrumbs, bodyText, linksContainerText = '', searchQuery } = params;
    const combined = `${rawTitle} ${breadcrumbs} ${linksContainerText} ${searchQuery || ''}`;
    const type = detectType(rawTitle, breadcrumbs);
    const year = extractYear(combined);
    const season = extractSeason(combined);
    const quality = extractQuality(combined);
    const { audio, subtitles } = extractLanguages(combined + ' ' + bodyText);
    const episodes = extractEpisodes(combined);
    const size = extractSize(combined) || extractSize(bodyText);
    const cleanTitle = extractCleanTitle(rawTitle);

    return {
        type,
        title: rawTitle || null,
        cleanTitle: cleanTitle || null,
        year,
        season,
        quality,
        audioLanguages: audio,
        subtitleLanguages: subtitles,
        episodesAvailable: episodes.available ?? null,
        episodesTotal: episodes.total ?? null,
        genres: [],
        size,
    };
}

function mergeMetadata(base: MediaMetadata, ai: MediaMetadata | null): MediaMetadata {
    if (!ai) return base;
    return {
        type: ai.type !== 'unknown' ? ai.type : base.type,
        title: ai.title || base.title,
        cleanTitle: ai.cleanTitle || base.cleanTitle || null,
        year: ai.year ?? base.year ?? null,
        season: ai.season ?? base.season ?? null,
        quality: ai.quality || base.quality || null,
        audioLanguages: ai.audioLanguages?.length ? ai.audioLanguages : base.audioLanguages,
        subtitleLanguages: ai.subtitleLanguages?.length ? ai.subtitleLanguages : base.subtitleLanguages,
        episodesAvailable: ai.episodesAvailable ?? base.episodesAvailable ?? null,
        episodesTotal: ai.episodesTotal ?? base.episodesTotal ?? null,
        genres: ai.genres?.length ? ai.genres : base.genres,
        size: ai.size || base.size || null,
    };
}

export async function POST(request: NextRequest) {
    try {
        const { forumId, postUrls, searchQuery, directTitles } = await request.json();

        // Modo directo: parsear títulos sin fetch (búsqueda nativa)
        if (directTitles && Array.isArray(directTitles) && directTitles.length > 0) {
            const results: MetadataResult[] = [];

            // AI provider (first enabled)
            let aiService: AIService | null = null;
            const aiProvider = await db.aIConfig.findFirst({ where: { enabled: true }, orderBy: { createdAt: 'desc' } });
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

                let aiMetadata: MediaMetadata | null = null;
                if (aiService) {
                    try {
                        aiMetadata = await aiService.extractMediaMetadata({
                            title,
                            breadcrumbs: '',
                            contentSnippet: snippet || '',
                            searchQuery,
                        });
                    } catch (err) {
                        logger.warn('metadata', `AI metadata failed: ${err}`);
                    }
                }

                const merged = mergeMetadata(heuristic, aiMetadata);
                results.push({ url: url || '', rawTitle: title, metadata: merged });
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

        // Check user testing settings for bypassAxios
        const token = request.cookies.get('sweaterr-auth')?.value;
        let bypassAxios = false;
        if (token) {
            try {
                const payload = await verifyTokenEdge(token);
                if (payload && typeof payload.id === 'string') {
                    const settings = await db.testingSettings.findUnique({ where: { userId: payload.id } });
                    bypassAxios = settings?.bypassAxios ?? false;
                }
            } catch {
                // ignore settings errors
            }
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

        const flaresolverrUrl = process.env.FLARESOLVERR_URL;
        const fsClient = flaresolverrUrl ? new FlareSolverrClient(flaresolverrUrl) : null;
        let sessionId: string | undefined;
        let usedFlareSolverr = false;
        const results: MetadataResult[] = [];

        // AI provider (first enabled)
        let aiService: AIService | null = null;
        const aiProvider = await db.aIConfig.findFirst({ where: { enabled: true }, orderBy: { createdAt: 'desc' } });
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
                if (bypassAxios) throw new Error('Bypass enabled');
                html = await tryAxios(postUrl);
            } catch (axiosErr) {
                if (!fsClient) {
                    results.push({ url: postUrl, error: 'FlareSolverr no configurado y Axios falló' });
                    continue;
                }

                try {
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
                } catch (solverErr) {
                    const message = solverErr instanceof Error ? solverErr.message : String(solverErr);
                    results.push({ url: postUrl, error: message });
                    continue;
                }
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

            const heuristic = buildHeuristicMetadata({
                rawTitle,
                breadcrumbs,
                bodyText,
                linksContainerText,
                searchQuery,
            });

            let aiMetadata: MediaMetadata | null = null;
            if (aiService) {
                try {
                    aiMetadata = await aiService.extractMediaMetadata({
                        title: rawTitle,
                        breadcrumbs,
                        contentSnippet: bodyText.substring(0, MAX_SNIPPET_CHARS),
                        searchQuery,
                    });
                } catch (err) {
                    logger.warn('metadata', `AI metadata failed: ${err}`);
                }
            }

            const merged = mergeMetadata(heuristic, aiMetadata);
            results.push({ url: postUrl, rawTitle, metadata: merged });
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
