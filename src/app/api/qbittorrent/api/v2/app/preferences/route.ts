import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/qbittorrent/api/v2/app/preferences
 * Returns qBittorrent application preferences
 * Sonarr may check this to verify compatibility
 */
export async function GET(request: NextRequest) {
    console.log('[qBittorrent] GET /api/v2/app/preferences');
    
    // Return a minimal preferences object that satisfies Sonarr's checks
    const prefs = {
        save_path: '/downloads',
        auto_tmm_enabled: false,
        torrent_changed_tmm_enabled: false,
    };
    
    console.log('[qBittorrent] Returning preferences:', JSON.stringify(prefs));
    
    return new NextResponse(
        JSON.stringify(prefs),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
