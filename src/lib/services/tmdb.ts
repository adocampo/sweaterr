import { logger } from '@/lib/logger';
import { TitleFacts } from '@/lib/services/ai';
import { extractCleanTitle } from '@/lib/metadata-extractor';
import { getTmdbApiKey } from '@/lib/services/tmdb-config';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface TitleReference {
    source: 'tmdb';
    type: 'series' | 'movie';
    title: string;
    originalTitle: string;
    /** ISO 639-1 code of the language the work was produced in. */
    originalLanguage: string;
    originCountries: string[];
    year: number | null;
    genres: string[];
    overview: string;
}

interface CacheEntry {
    value: TitleReference | null;
    expiresAt: number;
}

const lookupCache = new Map<string, CacheEntry>();
let genreCache: { map: Map<number, string>; expiresAt: number } | null = null;

async function getConfiguredTmdbApiKey(): Promise<string | null> {
    return getTmdbApiKey();
}

function buildRequest(path: string, params: Record<string, string>, key: string): { url: string; headers: Record<string, string> } {
    const search = new URLSearchParams(params);
    const headers: Record<string, string> = { Accept: 'application/json' };

    // v4 tokens are JWTs and travel in the Authorization header; v3 keys go in the query string.
    if (key.split('.').length === 3) {
        headers['Authorization'] = `Bearer ${key}`;
    } else {
        search.set('api_key', key);
    }

    return { url: `${TMDB_BASE}${path}?${search.toString()}`, headers };
}

async function tmdbGet<T>(path: string, params: Record<string, string>, timeoutMs = 10000): Promise<T> {
    const key = await getConfiguredTmdbApiKey();
    if (!key) throw new Error('TMDB is not configured');
    const { url, headers } = buildRequest(path, params, key);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { headers, signal: controller.signal });
        if (!response.ok) throw new Error(`TMDB ${response.status} ${response.statusText}`);
        return (await response.json()) as T;
    } finally {
        clearTimeout(timer);
    }
}

async function getGenreMap(language: string): Promise<Map<number, string>> {
    if (genreCache && genreCache.expiresAt > Date.now()) return genreCache.map;

    const map = new Map<number, string>();
    for (const kind of ['movie', 'tv'] as const) {
        const data = await tmdbGet<{ genres: Array<{ id: number; name: string }> }>(`/genre/${kind}/list`, { language });
        for (const genre of data.genres || []) map.set(genre.id, genre.name);
    }

    genreCache = { map, expiresAt: Date.now() + CACHE_TTL_MS };
    return map;
}

/** Strips release noise so TMDB gets something close to the real title. */
export function normalizeQuery(rawTitle: string): string {
    const cleaned = extractCleanTitle(rawTitle);
    return (cleaned || rawTitle)
        .replace(/[[(][^\]\)]*[\])]/g, ' ')
        .replace(/\b(capitulos?|episodios?)\b.*$/i, ' ')
        .replace(/\b\d{1,2}x\d{2,3}\b/gi, ' ')
        .replace(/\bS\d{1,2}(E\d{1,3})?\b/gi, ' ')
        .replace(/[\s\-–_:·|]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Looks a title up on TMDB to recover facts the forum title never states:
 * original language (needed to expand "Dual"), genres and year.
 */
export async function lookupTitle(
    rawTitle: string,
    options: { year?: number | null; type?: 'series' | 'movie' | 'unknown'; language?: string; onFailure?: (message: string) => void } = {}
): Promise<TitleReference | null> {
    if (!await getConfiguredTmdbApiKey()) return null;

    const query = normalizeQuery(rawTitle);
    if (query.length < 2) return null;

    const language = options.language || 'es-ES';
    const cacheKey = `${query.toLowerCase()}|${options.year || ''}|${options.type || ''}|${language}`;
    const cached = lookupCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
        const data = await tmdbGet<{ results: any[] }>('/search/multi', {
            query,
            language,
            include_adult: 'false',
        });

        const candidates = (data.results || []).filter((item) => item?.media_type === 'tv' || item?.media_type === 'movie');
        const preferred = options.type === 'series'
            ? candidates.find((item) => item.media_type === 'tv')
            : options.type === 'movie'
                ? candidates.find((item) => item.media_type === 'movie')
                : undefined;
        const match = preferred || candidates[0];

        if (!match) {
            logger.info('tmdb', `No match for "${query}" (from "${rawTitle}")`);
            lookupCache.set(cacheKey, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
            return null;
        }

        const genreMap = await getGenreMap(language).catch(() => new Map<number, string>());
        const date: string = match.first_air_date || match.release_date || '';

        const reference: TitleReference = {
            source: 'tmdb',
            type: match.media_type === 'tv' ? 'series' : 'movie',
            title: match.name || match.title || query,
            originalTitle: match.original_name || match.original_title || match.name || match.title || query,
            originalLanguage: match.original_language || '',
            originCountries: Array.isArray(match.origin_country) ? match.origin_country : [],
            year: date ? Number(date.slice(0, 4)) : null,
            genres: (match.genre_ids || []).map((id: number) => genreMap.get(id)).filter(Boolean),
            overview: typeof match.overview === 'string' ? match.overview.slice(0, 600) : '',
        };

        lookupCache.set(cacheKey, { value: reference, expiresAt: Date.now() + CACHE_TTL_MS });
        return reference;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.onFailure?.(message);
        logger.warn('tmdb', `Lookup failed for "${query}": ${message}`);
        return null;
    }
}

/** Maps a TMDB ISO 639-1 code to the tags used elsewhere in the app. */
export function toAppLanguage(iso: string, originCountries: string[] = []): string {
    if (!iso) return '';
    if (iso === 'es') {
        const latam = ['MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'UY', 'EC', 'BO', 'PY', 'CR', 'CU', 'DO', 'GT', 'HN', 'NI', 'PA', 'SV'];
        return originCountries.some((country) => latam.includes(country)) ? 'es-LA' : 'es-ES';
    }
    return iso;
}

/** Resolves a forum title into the facts consumed by the metadata pipeline. */
export async function resolveTitleFacts(
    rawTitle: string,
    options: { year?: number | null; type?: 'series' | 'movie' | 'unknown'; language?: string; onFailure?: (message: string) => void } = {}
): Promise<TitleFacts | null> {
    const found = await lookupTitle(rawTitle, options);
    if (!found) return null;

    return {
        type: found.type,
        title: found.title,
        originalTitle: found.originalTitle,
        originalLanguage: toAppLanguage(found.originalLanguage, found.originCountries),
        year: found.year,
        genres: found.genres,
    };
}

/** Resolves several titles at once; unknown or unconfigured lookups yield null. */
export async function resolveTitleFactsBatch(
    entries: Array<{ key: string; title: string; type?: 'series' | 'movie' | 'unknown'; year?: number | null }>,
    language?: string,
    onFailure?: (message: string) => void
): Promise<Map<string, TitleFacts | null>> {
    const map = new Map<string, TitleFacts | null>();
    if (!await getConfiguredTmdbApiKey()) return map;

    await Promise.all(
        entries.map(async (entry) => {
            map.set(entry.key, await resolveTitleFacts(entry.title, { year: entry.year, type: entry.type, language, onFailure }));
        })
    );

    return map;
}
