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
 * Search for a series by name using multiple strategies:
 * 1. Local cache first
 * 2. TVMaze API (free, no key required)
 * 3. OMDB fallback (if API key available)
 */
export async function searchSeries(seriesName: string): Promise<TVDBSeriesInfo | null> {
    const normalized = normalizeSeriesName(seriesName);

    // Check local cache first
    if (cache.series.has(normalized)) {
        logger.info('tvdb', `[Cache hit] Found series: ${seriesName}`);
        return cache.series.get(normalized) || null;
    }

    try {
        // Try TVMaze API (free, no authentication needed)
        const result = await searchTVMaze(seriesName);
        if (result) {
            cache.series.set(normalized, result);
            logger.info('tvdb', `[TVMaze] Found series: ${seriesName} (tvdbId: ${result.tvdbId})`);
            return result;
        }
    } catch (error) {
        logger.warn('tvdb', `[TVMaze] Search failed for "${seriesName}": ${error}`);
    }

    logger.warn('tvdb', `Could not find series: ${seriesName}`);
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
