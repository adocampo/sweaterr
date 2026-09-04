import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface TmdbSettings {
    apiKey: string | null;
    enabled: boolean;
    source: 'database' | 'env' | 'none';
}

const CACHE_TTL_MS = 30000;
let cache: { value: TmdbSettings; expiresAt: number } | null = null;

export function invalidateTmdbCache(): void {
    cache = null;
}

export async function getTmdbSettings(): Promise<TmdbSettings> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;

    const envApiKey = process.env.TMDB_API_KEY?.trim() || null;
    let value: TmdbSettings = {
        apiKey: envApiKey,
        enabled: true,
        source: envApiKey ? 'env' : 'none',
    };

    try {
        const config = await db.tmdbConfig.findFirst({ orderBy: { createdAt: 'desc' } });
        if (config) {
            value = {
                apiKey: config.apiKey.trim() || null,
                enabled: config.enabled,
                source: 'database',
            };
        }
    } catch (error) {
        logger.warn('tmdb', 'Could not read TMDB config from database, using environment', error);
    }

    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
}

export async function getTmdbApiKey(): Promise<string | null> {
    const settings = await getTmdbSettings();
    return settings.enabled ? settings.apiKey : null;
}
