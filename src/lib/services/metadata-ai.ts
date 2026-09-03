import { AIService, MediaMetadata, TitleFacts } from '@/lib/services/ai';
import { logger } from '@/lib/logger';
import {
    detectType,
    extractYear,
    extractSeason,
    extractQuality,
    extractLanguages,
    extractEpisodes,
    extractSize,
    extractCleanTitle,
} from '@/lib/metadata-extractor';

export interface EnrichItem {
    url: string;
    title: string;
    snippet?: string;
}

export interface EnrichOutcome {
    url: string;
    metadata?: MediaMetadata;
    elapsedMs: number;
    aiApplied: boolean;
    error?: string;
}

export function buildHeuristicMetadata(params: {
    rawTitle: string;
    breadcrumbs?: string;
    bodyText?: string;
    linksContainerText?: string;
    searchQuery?: string;
}): MediaMetadata {
    const { rawTitle, breadcrumbs = '', bodyText = '', linksContainerText = '', searchQuery } = params;
    const combined = `${rawTitle} ${breadcrumbs} ${linksContainerText} ${searchQuery || ''}`;
    const { audio, subtitles } = extractLanguages(`${combined} ${bodyText}`);
    const episodes = extractEpisodes(combined);

    // `extractLanguages` uses 'unknown' as a marker for "subtitles exist, language unclear".
    const hasUnknownMarker = subtitles.includes('unknown');
    const concreteSubtitles = subtitles.filter((lang) => lang !== 'unknown');

    return {
        type: detectType(rawTitle, breadcrumbs),
        title: rawTitle || null,
        cleanTitle: extractCleanTitle(rawTitle) || null,
        year: extractYear(combined),
        season: extractSeason(combined),
        quality: extractQuality(combined),
        audioLanguages: audio,
        audioTracks: [],
        subtitleLanguages: concreteSubtitles,
        subtitlesPresent: concreteSubtitles.length || hasUnknownMarker ? 'yes' : 'unknown',
        episodesAvailable: episodes.available ?? null,
        episodesTotal: episodes.total ?? null,
        genres: [],
        size: extractSize(combined) || extractSize(bodyText),
    };
}

/**
 * The title and TMDB are deterministic, so they win. The model only contributes
 * what they could not resolve, plus the per-track detail that lives in the post.
 */
export function mergeMetadata(base: MediaMetadata, ai: MediaMetadata | null): MediaMetadata {
    if (!ai) return base;

    const audioLanguages = Array.from(new Set([...(base.audioLanguages || []), ...(ai.audioLanguages || [])]));
    const subtitleLanguages = Array.from(new Set([...(base.subtitleLanguages || []), ...(ai.subtitleLanguages || [])]));
    const basePresence = base.subtitlesPresent;

    return {
        type: base.type !== 'unknown' ? base.type : ai.type,
        title: base.title || ai.title,
        cleanTitle: base.cleanTitle || ai.cleanTitle || null,
        year: base.year ?? ai.year ?? null,
        season: base.season ?? ai.season ?? null,
        quality: base.quality || ai.quality || null,
        audioLanguages,
        // Codec and channels only appear in the post, which the model reads.
        audioTracks: ai.audioTracks?.length ? ai.audioTracks : base.audioTracks ?? [],
        subtitleLanguages,
        subtitlesPresent:
            subtitleLanguages.length > 0
                ? 'yes'
                : basePresence && basePresence !== 'unknown'
                    ? basePresence
                    : ai.subtitlesPresent ?? 'unknown',
        episodesAvailable: base.episodesAvailable ?? ai.episodesAvailable ?? null,
        episodesTotal: base.episodesTotal ?? ai.episodesTotal ?? null,
        genres: base.genres?.length ? base.genres : ai.genres ?? [],
        size: base.size || ai.size || null,
    };
}

/**
 * "Dual" states two audio tracks without naming them: the forum's default language
 * plus the work's original language. Pure string logic, no AI involved.
 */
export function expandDualAudio(
    metadata: MediaMetadata,
    options: { rawTitle: string; forumLanguage: string; originalLanguage?: string }
): MediaMetadata {
    if (!/\bdual\b/i.test(options.rawTitle)) return metadata;

    const audioLanguages = [...(metadata.audioLanguages || [])];
    const audioTracks = [...(metadata.audioTracks || [])];

    for (const language of [options.originalLanguage, options.forumLanguage]) {
        if (!language || audioLanguages.includes(language)) continue;
        audioLanguages.push(language);
        audioTracks.push({ language, codec: null, channels: null });
    }

    return { ...metadata, audioLanguages, audioTracks };
}

/**
 * Folds external database facts into metadata. Runs with or without AI, so year,
 * genres and the original language behind "Dual" are available on every result.
 */
export function applyReference(
    metadata: MediaMetadata,
    reference: TitleFacts | null,
    options: { rawTitle: string; forumLanguage?: string }
): MediaMetadata {
    const forumLanguage = options.forumLanguage || 'es-ES';
    const expanded = expandDualAudio(metadata, {
        rawTitle: options.rawTitle,
        forumLanguage,
        originalLanguage: reference?.originalLanguage,
    });

    if (!reference) return expanded;

    return {
        ...expanded,
        type: expanded.type !== 'unknown' ? expanded.type : reference.type,
        cleanTitle: expanded.cleanTitle || reference.title,
        year: expanded.year ?? reference.year ?? null,
        genres: expanded.genres?.length ? expanded.genres : reference.genres,
    };
}

/** Runs tasks with a small pool so a local llama.cpp is not flooded. */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= items.length) return;
            results[index] = await worker(items[index]);
        }
    });

    await Promise.all(runners);
    return results;
}

export async function enrichItemsWithAI(
    items: EnrichItem[],
    aiService: AIService,
    options: {
        searchQuery?: string;
        forumDefaultLanguage?: string;
        concurrency?: number;
        /** Opening-post text and external facts, keyed by post URL. */
        postTexts?: Map<string, string>;
        references?: Map<string, TitleFacts | null>;
    } = {}
): Promise<EnrichOutcome[]> {
    const { searchQuery, forumDefaultLanguage, concurrency = 1, postTexts, references } = options;

    return mapWithConcurrency(items, concurrency, async (item) => {
        const started = Date.now();
        const postText = postTexts?.get(item.url) || '';
        const reference = references?.get(item.url) || null;
        const heuristic = applyReference(
            buildHeuristicMetadata({
                rawTitle: item.title,
                bodyText: postText || item.snippet || '',
                searchQuery,
            }),
            reference,
            { rawTitle: item.title, forumLanguage: forumDefaultLanguage }
        );

        try {
            const aiMetadata = await aiService.extractMediaMetadata({
                title: item.title,
                contentSnippet: item.snippet || '',
                postText,
                reference,
                known: heuristic,
                searchQuery,
                forumDefaultLanguage,
            });

            logger.info('metadata', `AI metadata fields for "${item.title}"`, {
                postChars: postText.length,
                hasGenreLabel: /g[eé]nero/i.test(postText),
                hasMediaInfo: /mediainfo/i.test(postText),
                genres: aiMetadata?.genres || [],
                subtitleLanguages: aiMetadata?.subtitleLanguages || [],
                subtitlesPresent: aiMetadata?.subtitlesPresent || 'unknown',
            });

            return {
                url: item.url,
                metadata: applyReference(mergeMetadata(heuristic, aiMetadata), reference, {
                    rawTitle: item.title,
                    forumLanguage: forumDefaultLanguage,
                }),
                elapsedMs: Date.now() - started,
                aiApplied: !!aiMetadata,
                error: aiMetadata ? undefined : 'AI returned no usable metadata',
            };
        } catch (err) {
            return {
                url: item.url,
                metadata: heuristic,
                elapsedMs: Date.now() - started,
                aiApplied: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });
}
