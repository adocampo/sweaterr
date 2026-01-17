import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/qbittorrent/api/v2/app/preferences
 * Returns qBittorrent application preferences
 * Sonarr may check this to verify compatibility
 */
export async function GET(request: NextRequest) {
    logger.info('qbittorrent', 'GET /api/v2/app/preferences');
    
    // Return a minimal preferences object that satisfies Sonarr's checks
    return new NextResponse(
        JSON.stringify({
            save_path: '/downloads',
            auto_tmm_enabled: false,
            torrent_changed_tmm_enabled: false,
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
