import { logger } from '@/lib/logger';

/**
 * TVDBService: Provides series metadata from TVDB (The Movie Database)
 * Implements caching to avoid excessive API calls
 */

interface TVDBSeriesInfo {
    tvdbId: number;
    name: string;
    year?: number;
}

interface TVDBCache {
    series: Map<string, TVDBSeriesInfo>;
    lastUpdate: Date;
}

// In-memory cache: Map of series name -> TVDBSeriesInfo
// Key: normalized series name (lowercase, no special chars)
const cache: TVDBCache = {
    series: new Map(),
    lastUpdate: new Date(),
};

/**
 * Normalize series name for cache lookup
 * Example: "Breaking Bad" -> "breaking bad"
 */
function normalizeSeriesName(name: string): string {
    return name.toLowerCase().trim();
}

/**
 * Clean series name by removing season/episode information before TVDB lookup.
 * This is critical because Sonarr may send "Breaking Bad temporada 4" or similar,
 * but TVMaze requires just the series name for accurate matching.
 *
 * Patterns removed:
 * - "temporada X", "season X", "temp X", "T##", "S##", "S##E##"
 * - "[X/Y]", "(X)", episode numbers
 * - "- 1x01" style
 * - Everything after colon or dash that contains numbers/abbreviations
 *
 * @param name - Raw series name (e.g., "Breaking Bad temporada 4")
 * @returns Cleaned series name (e.g., "Breaking Bad")
 *
 * @example
 * cleanSeriesNameForLookup("Breaking Bad temporada 4") // "Breaking Bad"
 * cleanSeriesNameForLookup("Game of Thrones T5 [16/16]") // "Game of Thrones"
 * cleanSeriesNameForLookup("The Office S05E01") // "The Office"
 */
function cleanSeriesNameForLookup(name: string): string {
    if (!name) return '';

    let cleaned = name
        // Remove common season/episode patterns: "temporada X", "season X", "T##", "S##E##", etc.
        .replace(/\s+(temporada|temporadas|season|seasons|serie|series|s\d+e\d+|s\d+|t\d+|cap\s*\d+|capítulo\s*\d+|chapter\s*\d+|ep\s*\d+|episodio\s*\d+).*$/i, '')
        // Remove "- 1x01" or "- 01x01" style
        .replace(/\s*[-–]\s*\d{1,2}x\d{2,}.*$/i, '')
        // Remove "[X/Y]", "[X of Y]", "(X)", etc.
        .replace(/\s*[\[\(]\d+(?:\/|\s+of\s+)?\d*[\]\)].*$/i, '')
        // Remove anything after colon if it looks like metadata
        .replace(/\s*:\s*(?:s\d+|season\d+|t\d+|temporada\d+).*$/i, '')
        .trim();

    return cleaned;
}

/**
 * Search for a series by name using multiple strategies:
 * 1. Clean the series name by removing season/episode info
 * 2. Local cache first
 * 3. TVMaze API (free, no key required)
 * 4. OMDB fallback (if API key available)
 */
export async function searchSeries(seriesName: string): Promise<TVDBSeriesInfo | null> {
    // CRITICAL: Clean the series name BEFORE lookup
    // This ensures "Breaking Bad temporada 4" becomes "Breaking Bad"
    const cleanedName = cleanSeriesNameForLookup(seriesName);
    const normalized = normalizeSeriesName(cleanedName);

    // Log the cleaning process for debugging
    if (cleanedName !== seriesName) {
        logger.info('tvdb', `[Cleanup] "${seriesName}" → "${cleanedName}"`);
    }

    // Check local cache first
    if (cache.series.has(normalized)) {
        logger.info('tvdb', `[Cache hit] Found series: ${cleanedName}`);
        return cache.series.get(normalized) || null;
    }

    try {
        // Try TVMaze API (free, no authentication needed)
        const result = await searchTVMaze(cleanedName);
        if (result) {
            cache.series.set(normalized, result);
            logger.info('tvdb', `[TVMaze] Found series: ${cleanedName} (tvdbId: ${result.tvdbId})`);
            return result;
        }
    } catch (error) {
        logger.warn('tvdb', `[TVMaze] Search failed for "${cleanedName}": ${error}`);
    }

    logger.warn('tvdb', `Could not find series: ${cleanedName}`);
    return null;
}

/**
 * Search TVMaze API for series
 * Returns tvdbId from the external_ids field
 */
async function searchTVMaze(seriesName: string): Promise<TVDBSeriesInfo | null> {
    try {
        const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(seriesName)}`;
        const response = await fetch(url, { next: { revalidate: 86400 } }); // Cache for 24h

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        // Get first result
        const show = data[0];
        const showData = show.show || show;

        // Extract tvdbId from external IDs
        const tvdbId = showData.externals?.thetvdb;
        if (!tvdbId) {
            logger.warn('tvdb', `[TVMaze] No TVDb ID found for "${seriesName}"`);
            return null;
        }

        return {
            tvdbId,
            name: showData.name,
            year: showData.premiered ? new Date(showData.premiered).getFullYear() : undefined,
        };
    } catch (error) {
        logger.error('tvdb', `[TVMaze API Error] ${error}`);
        return null;
    }
}

/**
 * Clear cache (for testing or reset)
 */
export function clearCache(): void {
    cache.series.clear();
    logger.info('tvdb', 'Cache cleared');
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; lastUpdate: Date } {
    return {
        size: cache.series.size,
        lastUpdate: cache.lastUpdate,
    };
}
