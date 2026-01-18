import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { addCategory } from '@/lib/services/qbittorrent-state';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const url = new URL(request.url);
    const category = url.searchParams.get('category') || body.split('=')[1] || '';
    
    logger.info('api', `[qBittorrent] POST /api/v2/torrents/createCategory category=${category}`);
    console.log('[qBittorrent] POST /api/v2/torrents/createCategory category=' + category);
    console.log('[qBittorrent] Body:', body);

    // Save the category in our in-memory store
    if (category) {
      addCategory(category);
      logger.info('api', `[qBittorrent] Category "${category}" stored in memory`);
      console.log(`[qBittorrent] Category "${category}" stored in memory`);
    }

    logger.info('api', '[qBittorrent] Category created successfully');
    console.log('[qBittorrent] Category created');

    return NextResponse.json({ success: true }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logger.error('api', '[qBittorrent] Error in POST /api/v2/torrents/createCategory', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
