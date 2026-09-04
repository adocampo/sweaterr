import { NextRequest, NextResponse } from 'next/server';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import { getFlareSolverrSettings } from '@/lib/services/flaresolverr-config';

import { logger } from '@/lib/logger';

// POST /api/config/flaresolverr/check - Ping the given URL, or the stored one
export async function POST(request: NextRequest) {
    let url: string | null = null;

    try {
        const body = await request.json().catch(() => ({}));
        url = typeof body?.url === 'string' && body.url.trim()
            ? body.url.trim()
            : (await getFlareSolverrSettings()).url;

        logger.info('flaresolverr', 'Test connection requested', { url, bodyUrl: typeof body?.url === 'string' ? body.url.trim() : null });

        if (!url) {
            logger.warn('flaresolverr', 'No FlareSolverr URL configured');
            return NextResponse.json(
                { success: false, error: 'No FlareSolverr URL configured' },
                { status: 400 }
            );
        }

        const started = Date.now();
        const info = await new FlareSolverrClient(url).ping();
        const elapsed = Date.now() - started;

        logger.info('flaresolverr', 'Test connection succeeded', { url, version: info.version, sessions: info.sessions, elapsedMs: elapsed });

        return NextResponse.json({
            success: true,
            data: { url, version: info.version, sessions: info.sessions, elapsedMs: elapsed },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        logger.warn('flaresolverr', 'Test connection failed', { url, error: errorMessage });
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 400 }
        );
    }
}
