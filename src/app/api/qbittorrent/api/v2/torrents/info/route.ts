import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/qbittorrent/api/v2/torrents/info
 * Returns information about torrents
 * This is a mock endpoint that returns an empty list
 */
export async function GET(request: NextRequest) {
    logger.info('qbittorrent', 'GET /api/v2/torrents/info');
    
    // Return empty list of torrents
    // Sonarr doesn't typically query this, but it's good to have for compatibility
    return new NextResponse(
        JSON.stringify([]),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
