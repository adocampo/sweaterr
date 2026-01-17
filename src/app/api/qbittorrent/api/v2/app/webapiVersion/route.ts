import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/qbittorrent/api/v2/app/webapiVersion
 * Returns qBittorrent Web API version
 * Sonarr uses this to verify it's talking to a valid qBittorrent instance
 * Must return version in format that System.Version.Parse() can understand
 */
export async function GET(request: NextRequest) {
    logger.info('qbittorrent', 'GET /api/v2/app/webapiVersion');
    
    // Return a version that's compatible with Sonarr's expectations
    // qBittorrent typically returns "2.8.3", "2.9.0", etc.
    // But System.Version.Parse() requires at least 2 parts (major.minor)
    // and can handle up to 4 (major.minor.build.revision)
    // Using 4-part version: major.minor.build.revision
    return new NextResponse('2.9.0.0', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
    });
}
