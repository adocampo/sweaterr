import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/qbittorrent/
 * Catch-all for root qBittorrent API requests
 */
export async function GET(request: NextRequest) {
    logger.info('qbittorrent', 'GET / - qBittorrent API root endpoint');
    return new NextResponse(
        JSON.stringify({
            app: 'Sweaterr qBittorrent API',
            version: '1.0.0',
            message: 'This is a qBittorrent-compatible API endpoint for Sonarr/Radarr integration',
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

/**
 * POST /api/qbittorrent/
 * Catch-all for root qBittorrent API POST requests
 */
export async function POST(request: NextRequest) {
    logger.info('qbittorrent', 'POST / - qBittorrent API root endpoint');
    return new NextResponse(
        JSON.stringify({
            error: 'Invalid qBittorrent API endpoint',
        }),
        {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
