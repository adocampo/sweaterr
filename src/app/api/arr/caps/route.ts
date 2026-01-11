import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET /api/arr/caps - Newznab/Torznab capabilities endpoint
// Validates API key against forum's torznabApiKey
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apikey') || request.headers.get('x-api-key');
    
    logger.info('ARR_CAPS', `Caps request received. API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);

    if (!apiKey) {
      logger.warn('ARR_CAPS', 'Missing API key in request');
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
        {
          status: 401,
          headers: { 'Content-Type': 'application/xml' },
        }
      );
    }

    // Validate API key against forum's torznabApiKey
    const forum = await db.forum.findFirst({
      where: { torznabApiKey: apiKey },
    });
    
    logger.info('ARR_CAPS', `Forum lookup result: ${forum ? `Found forum '${forum.name}'` : 'NOT FOUND'}`);

    if (!forum || !forum.enabled) {
      logger.warn('ARR_CAPS', `Invalid API key or forum disabled. Forum: ${forum ? 'found but disabled' : 'not found'}`);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
        {
          status: 401,
          headers: { 'Content-Type': 'application/xml' },
        }
      );
    }

    // Return Newznab/Torznab capabilities
    // For now, return TV categories (future: analyze forum to determine type)
    // TODO: Detect forum type (Series/Películas/Música/Libros) and return appropriate categories
    const capsXml = `<?xml version="1.0" encoding="UTF-8"?>
<caps>
  <server version="1.0" title="Sweaterr - ${forum.name}" strapline="Direct download indexer" email="" url="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" image="" type="nzb" />
  <limits max="100" default="100"/>
  <registration available="no" open="no"/>
  <searching>
    <search available="yes" supportedParams="q,cat"/>
    <tv-search available="yes" supportedParams="q,season,ep,cat"/>
    <movie-search available="yes" supportedParams="q,imdbid,tmdbid,cat"/>
    <audio-search available="yes" supportedParams="q,artist,album,cat"/>
    <book-search available="yes" supportedParams="q,author,title,cat"/>
  </searching>
  <categories>
    <category id="5000" name="TV">
      <subcat id="5020" name="Foreign"/>
      <subcat id="5030" name="SD"/>
      <subcat id="5040" name="HD"/>
      <subcat id="5045" name="UHD"/>
    </category>
    <category id="2000" name="Movies">
      <subcat id="2010" name="Foreign"/>
      <subcat id="2020" name="SD"/>
      <subcat id="2030" name="HD"/>
      <subcat id="2040" name="UHD"/>
      <subcat id="2045" name="BluRay"/>
      <subcat id="2050" name="3D"/>
    </category>
    <category id="3000" name="Audio">
      <subcat id="3010" name="MP3"/>
      <subcat id="3020" name="FLAC"/>
      <subcat id="3030" name="Other"/>
    </category>
    <category id="7000" name="Books">
      <subcat id="7010" name="Ebook"/>
      <subcat id="7020" name="Comics"/>
    </category>
  </categories>
</caps>`;
    
    logger.info('ARR_CAPS', `Returning capabilities for forum '${forum.name}'`);

    return new NextResponse(capsXml, {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (error) {
    logger.error('ARR_CAPS', 'Error in caps endpoint', error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<error code="900" description="Internal server error"/>`,
      {
        status: 500,
        headers: { 'Content-Type': 'application/xml' },
      }
    );
  }
}
