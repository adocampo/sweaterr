import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    const userAgent = request.headers.get('user-agent');
    logger.info('api', `[qBittorrent] GET /api/v2/app/webapiVersion from ${userAgent}`);
    
    // Try returning as plain JSON object - some clients expect this
    // qBittorrent Web API v2.8.3 format
    return new NextResponse(JSON.stringify({ version: '2.8.3' }), {
        status: 200,
        headers: { 
            'Content-Type': 'application/json',
        },
    });
}
