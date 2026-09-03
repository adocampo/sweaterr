import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface FlareSolverrSettings {
    url: string | null;
    timeout: number;
    enabled: boolean;
    /** Where the values came from, so the UI can explain what is in effect. */
    source: 'database' | 'env' | 'none';
}

export const DEFAULT_FLARESOLVERR_TIMEOUT = 60000;

const CACHE_TTL_MS = 30000;
let cache: { value: FlareSolverrSettings; expiresAt: number } | null = null;

/** Call after any write so the next request sees the new values. */
export function invalidateFlareSolverrCache(): void {
    cache = null;
}

export async function getFlareSolverrSettings(): Promise<FlareSolverrSettings> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;

    const envUrl = process.env.FLARESOLVERR_URL?.trim() || process.env.NEXT_PUBLIC_FLARESOLVERR_URL?.trim() || null;
    let value: FlareSolverrSettings = {
        url: envUrl,
        timeout: DEFAULT_FLARESOLVERR_TIMEOUT,
        enabled: true,
        source: envUrl ? 'env' : 'none',
    };

    try {
        const config = await db.flareSolverrConfig.findFirst({ orderBy: { createdAt: 'desc' } });
        if (config) {
            value = {
                url: config.url?.trim() || null,
                timeout: config.timeout,
                enabled: config.enabled,
                source: 'database',
            };
        }
    } catch (error) {
        logger.warn('cloudflare', 'Could not read FlareSolverr config from database, using environment', error);
    }

    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
}

/** Null means "go direct": either the user disabled the bypass or nothing is configured. */
export async function getFlareSolverrUrl(): Promise<string | null> {
    const settings = await getFlareSolverrSettings();
    return settings.enabled ? settings.url : null;
}
