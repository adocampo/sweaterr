import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getCategories } from '@/lib/services/qbittorrent-state';

export async function GET(request: NextRequest) {
  try {
    logger.info('api', '[qBittorrent] GET /api/v2/torrents/categories');
    console.log('[qBittorrent] GET /api/v2/torrents/categories');

    // Get categories from our in-memory store
    const categories = getCategories();

    logger.info('api', '[qBittorrent] Returning categories');
    console.log('[qBittorrent] Returning categories:', categories);

    return NextResponse.json(categories, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logger.error('api', '[qBittorrent] Error in GET /api/v2/torrents/categories', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
