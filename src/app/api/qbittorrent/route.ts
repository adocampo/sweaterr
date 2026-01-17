import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/qbittorrent/
 * Catch-all for root qBittorrent API requests
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const path = url.pathname;
    const query = url.search;
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    logger.info('api', `[qBittorrent CATCH-ALL] GET ${path}${query} from ${userAgent}`);
    console.log(`[qBittorrent CATCH-ALL] GET ${path}${query}`);
    console.log(`[qBittorrent CATCH-ALL] User-Agent: ${userAgent}`);
    console.log(`[qBittorrent CATCH-ALL] Headers:`, Object.fromEntries(request.headers.entries()));
    
    return new NextResponse(
        JSON.stringify({
            app: 'Sweaterr qBittorrent API',
            version: '1.0.0',
            message: 'This is a qBittorrent-compatible API endpoint for Sonarr/Radarr integration',
            received_path: path,
            received_query: query,
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
    const url = new URL(request.url);
    const path = url.pathname;
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    let body = '';
    try {
        body = await request.text();
    } catch (e) {
        body = '(could not read body)';
    }
    
    logger.info('api', `[qBittorrent CATCH-ALL] POST ${path} from ${userAgent}`);
    console.log(`[qBittorrent CATCH-ALL] POST ${path}`);
    console.log(`[qBittorrent CATCH-ALL] User-Agent: ${userAgent}`);
    console.log(`[qBittorrent CATCH-ALL] Body: ${body.substring(0, 500)}`);
    
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
