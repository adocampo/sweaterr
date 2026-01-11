import { NextRequest, NextResponse } from 'next/server';
import * as Caps from './caps/route';
import * as Search from './search/route';
import * as Grab from './grab/route';

// Unified Torznab/Newznab-style endpoint: /api/arr?t=caps|search|tvsearch|movie|get&apikey=<forum-torznab-api-key>
// Each forum has its own Torznab API key (torznabApiKey field)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const t = (searchParams.get('t') || '').toLowerCase();

    switch (t) {
      case 'caps':
        // Delegate to caps endpoint
        return await Caps.GET(request);
      case 'search':
      case 'tvsearch':
      case 'movie':
      case 'audio':
      case 'book':
        // Delegate to search endpoint (it already inspects params like q/season/ep)
        return await Search.GET(request);
      case 'get': {
        // Some clients use t=get&id=<guid> to retrieve NZB; map to our grab endpoint
        // Our grab handler expects guid via search param and apikey validation
        return await Grab.GET(request);
      }
      default:
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>\n<error code="200" description="Invalid or unsupported 't' parameter"/>`,
          { status: 400, headers: { 'Content-Type': 'application/xml' } }
        );
    }
  } catch (error) {
    console.error('[ARR] Dispatcher error:', error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<error code="900" description="Internal server error"/>`,
      { status: 500, headers: { 'Content-Type': 'application/xml' } }
    );
  }
}
