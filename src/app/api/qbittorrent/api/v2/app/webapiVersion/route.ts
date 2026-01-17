import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    const userAgent = request.headers.get('user-agent');
    const version = '2.8.3';
    
    logger.info('api', `[qBittorrent] GET /api/v2/app/webapiVersion from ${userAgent || 'unknown'}`);
    console.log(`[qBittorrent] GET /api/v2/app/webapiVersion from ${userAgent || 'unknown'}`);
    console.log(`[qBittorrent] Returning plain text: "${version}"`);
    
    // Return plain text only - no JSON, no charset encoding
    const response = new NextResponse(version, {
        status: 200,
        headers: { 
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
        },
    });
    
    logger.info('api', `[qBittorrent] webapiVersion response sent: status ${response.status}`);
    return response;
}
