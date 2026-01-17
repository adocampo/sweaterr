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

// Detect if text contains [X/Y] episode pattern (indicates series)
function detectSeriesByEpisodePattern(text: string): boolean {
    // Match patterns like [13/13], [13 de 13], [ 13 / 13 ], [13de13]
    return /\[\s*(\d{1,3})\s*(?:de|\/)\s*(\d{1,3})\s*\]/i.test(text);
}

function detectType(title: string, breadcrumbs: string): 'series' | 'movie' | 'unknown' {
    // STRICT: If there's an episode pattern, it's definitely a series
    if (detectSeriesByEpisodePattern(title)) {
        return 'series';
    }
    
    // Only detect as series if there are CLEAR season-related indicators in the TITLE
    // Don't rely on breadcrumbs or generic "serie" keyword, which are too permissive
    const lowerTitle = title.toLowerCase();
    
    const hasSeasonIndicators = 
        /\btemporada\s+\d+\b/i.test(title) ||
        /\d+(?:ª|º)\s+.{0,20}?\btemporada\b/i.test(title) || // 5ª 2/2 Temporada Final
        /\d+(?:ª|º)\s*temporada\b/i.test(title) || // 5ª Temporada, 3º Temporada
        /\b[Tt]\s*\d{1,2}\b/.test(title) ||
        /\bseason\s+\d+\b/i.test(title) ||
        /\bs\d{1,2}\b/i.test(title) ||
        /\bserial\b/i.test(title);
    
    if (hasSeasonIndicators) {
        return 'series';
    }
    
    // Check for movie keywords
    const movieKeywords = ['película', 'movie', 'film', 'cinema'];
    if (movieKeywords.some(keyword => lowerTitle.includes(keyword))) {
        return 'movie';
    }
    
    // Default to unknown for ambiguous content that doesn't match clear patterns
    // This prevents false positives for incorrectly posted content
    return 'unknown';
}

function extractYear(text: string): number | null {
    const match = text.match(/\b(19|20)\d{2}\b/);
    if (!match) return null;
    const year = parseInt(match[0], 10);
    if (year < 1950 || year > new Date().getFullYear() + 1) return null;
    return year;
}

function extractSeason(text: string): number | null {
    // Priority 1: Ordinal patterns with possible text between: "5ª 2/2 Temporada Final", "3º mitad Temporada"
    // Allow up to 20 chars between ordinal and "temporada" word to be flexible
    let match = text.match(/(\d{1,2})(?:ª|º)\s+.{0,20}?\b(?:temporada|temp\.?|season)\b/i);
    if (match) return parseInt(match[1], 10);
    
    // Standard ordinal without text between: "5ª Temporada", "3º Season"
    match = text.match(/(\d{1,2})(?:ª|º)\s*(?:temporada|temp\.?|season)/i);
    if (match) return parseInt(match[1], 10);

    // Reverse pattern: "Temporada 15ª", "Season 3º"
    match = text.match(/(?:temporada|temp\.?|season)\s*(\d{1,2})(?:ª|º)?/i);
    if (match) return parseInt(match[1], 10);

    // Priority 2: T-prefixed patterns: T1, T.1, T5ª, etc
    match = text.match(/\b[Tt]\.?(\d{1,2})/i);
    if (match) return parseInt(match[1], 10);

    // Priority 3: S-prefixed patterns: S1, Season 1, etc
    match = text.match(/\b[Ss](?:eason)?\s*(\d{1,2})/i);
    if (match) return parseInt(match[1], 10);

    return null;
}

function extractQuality(text: string): string | null {
    const qualityMatch = text.match(/\b(2160p|4k|1080p|720p|480p)\b/i);
    const sourceMatch = text.match(/\b(BluRay|BRRip|WEB[- ]?DL|WebRip|HDRip|DVDRip|HMAX|DVDScr)\b/i);
    if (qualityMatch && sourceMatch) return `${qualityMatch[1]} ${sourceMatch[1]}`;
    if (qualityMatch) return qualityMatch[1];
    return null;
}

function extractLanguages(text: string): { audio: string[]; subtitles: string[] } {
    const lower = text.toLowerCase();
    const audio: string[] = [];
    const subtitles: string[] = [];

    const audioMatchers: Record<string, RegExp[]> = {
        'es-ES': [/castellano/, /español/, /es-?es/],
        'es-LA': [/latino/, /latam/],
        en: [/ingles/, /inglés/, /english/],
        fr: [/frances/, /francés/],
    };

    const subtitleMatchers: Record<string, RegExp[]> = {
        'es-ES': [/sub(?:s|titulos)?\s*(?:es|esp|español|castellano)/, /sub\s?esp/],
        en: [/sub(?:s|titles)?\s*en/, /sub\s?ing/],
    };

    Object.entries(audioMatchers).forEach(([lang, patterns]) => {
        if (patterns.some((rx) => rx.test(lower))) audio.push(lang);
    });

    Object.entries(subtitleMatchers).forEach(([lang, patterns]) => {
        if (patterns.some((rx) => rx.test(lower))) subtitles.push(lang);
    });

    // Generic subtitles
    if (/subtit|subs/.test(lower) && subtitles.length === 0) subtitles.push('unknown');

    return { audio, subtitles };
}

function extractEpisodes(text: string): { available?: number | null; total?: number | null } {
    // Match patterns like [13/13], [13 de 13], [ 13 / 13 ]
    const match = text.match(/\[\s*(\d{1,3})\s*(?:de|\/)\s*(\d{1,3})\s*\]/i);
    if (match) {
        const available = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        // Validate range 1-300
        if (available >= 1 && available <= 300 && total >= 1 && total <= 300) {
            return { available, total };
        }
    }
    return {};
}

// Extract clean title by removing metadata (year, season, episodes, quality, size, languages, etc)
function extractCleanTitle(text: string): string {
    let clean = text;
    
    // Remove year patterns (1900-2099)
    clean = clean.replace(/\b(19|20)\d{2}\b/g, '');
    
    // Remove ordinal season+episode patterns: 5ª 1/2, 5ª 2/, 3º 1/2, etc
    clean = clean.replace(/\b\d{1,2}(?:ª|º)\s+\d{1,2}\/\d{0,2}\b/gi, '');
    clean = clean.replace(/\b\d{1,2}(?:ª|º)\s+\d{1,2}\/\b/gi, '');
    
    // Remove season patterns: T1, T.1, T01, Temporada 1, 1ª Temporada, Season 1, etc
    clean = clean.replace(/\b[Tt]\.?\d{1,2}\b/gi, '');
    clean = clean.replace(/\b(?:[Tt]emporada|[Ss]eason)\s+\d{1,2}(?:ª|º)?\b/gi, '');
    clean = clean.replace(/\b\d{1,2}(?:ª|º)?\s+(?:[Tt]emporada|[Ss]eason)\b/gi, '');
    
    // Remove standalone "Temporada" or "Season" words (in case they remain after number removal)
    clean = clean.replace(/\b(?:[Tt]emporada|[Ss]eason)\b/gi, '');
    
    // Remove "Final" keyword (often used for final season/episodes)
    clean = clean.replace(/\bFinal\b/gi, '');
    
    // Remove episode/chapter patterns: [13/13], [13 de 13], Capítulo 5, etc
    clean = clean.replace(/\[\s*\d{1,3}\s*(?:de|\/)\s*\d{1,3}\s*\]/gi, '');
    clean = clean.replace(/\b(?:[Cc]apítulo|[Ee]pisodio|[Cc]ap\.|[Ee]p\.?)\s+\d+\b/gi, '');
    
    // Remove quality patterns: 2160p, 4K, 1080p, 720p, 480p
    clean = clean.replace(/\b(2160p|4k|1080p|720p|480p)\b/gi, '');
    
    // Remove source patterns: BluRay, WEB-DL, HDRip, h.264, x.265, HEVC, etc
    clean = clean.replace(/\b(BluRay|BRRip|WEB[-\s]?DL|WebRip|HDRip|DVDRip|HMAX|DVDScr|h\.?264|h\.?265|x\.?264|x\.?265|hevc|avc)\b/gi, '');
    
    // Remove audio formats and codecs: DDP5.1, DD5.1, AC35.1, 5.1, 7.1, etc
    clean = clean.replace(/\b(DDP|DD|AC3|AAC|FLAC)\s*\d\.\d\b/gi, '');
    clean = clean.replace(/\b\d\.\d\s*(?:ch|channels|canales)?\b/gi, '');
    
    // Remove HDR/color patterns: Dolby Vision, HDR, HDR10, 10-bit, etc
    clean = clean.replace(/\b(Dolby\s+Vision|Dolby\s+Atmos|HDR10|HDR|10[-\s]?bit|Dolby\s+Digital)\b/gi, '');
    
    // Remove size patterns: 2.5GB, 3.14 MB, etc
    clean = clean.replace(/\b\d+(?:[.,]\d+)?\s*(?:GB|GiB|MB|MiB)\b/gi, '');
    
    // Remove language patterns and subtitle indicators: Dual, Castellano, Inglés, Español, English, Subt, Subs, etc
    clean = clean.replace(/\b(?:Dual|Castellano|Español|Inglés|English|Francés|Latino|Latin|Latam|Japones|Japonés|Coreano|Koreano|Subt|Subs|Sub)\b/gi, '');
    
    // Remove special/bracketed patterns: [...] and (...)
    clean = clean.replace(/\[.*?\]/g, '');
    clean = clean.replace(/\(.*?\)/g, '');
    
    // Remove + prefixed metadata (e.g., "+ Subt", "+ Castellano", "+ Dual")
    clean = clean.replace(/\s*\+\s+\w+/gi, '');
    clean = clean.replace(/\s*\+\s*$/g, ''); // Remove trailing +
    
    // Remove stray brackets and plus signs that may remain
    clean = clean.replace(/[\[\]]/g, '');
    clean = clean.replace(/\s*\+\s*$/g, ''); // Remove trailing + with spaces
    clean = clean.replace(/^\s*\+\s*/g, ''); // Remove leading + with spaces
    
    // Remove extra whitespace and trim
    clean = clean.replace(/\s+/g, ' ').trim();
    
    return clean;
}

function extractSize(text: string): string | null {
    // Match patterns like "2.5GB", "2,5 GB", "1500MB", etc.
    // Use word boundaries to avoid matching partial numbers
    const match = text.match(/\b(\d+(?:[.,]\d+)?)\s*(GB|GiB|MB|MiB)\b/i);
    if (!match) return null;
    // Normalize decimal separator to dot
    const size = match[1].replace(',', '.');
    return `${size} ${match[2].toUpperCase()}`;
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
                if (!fsClient) {
                    results.push({ url: postUrl, error: 'FlareSolverr no configurado' });
                    continue;
                }

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
