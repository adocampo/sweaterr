import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    const userAgent = request.headers.get('user-agent');
    logger.info('qbittorrent', `GET /api/v2/app/webapiVersion from ${userAgent}`);
    
    // qBittorrent v4.1.0+ returns just the API version (e.g., "2.8.3")
    // Sonarr expects this format and parses it with System.Version.Parse()
    const version = '2.8.3';
    
    logger.info('qbittorrent', `Returning version: "${version}" (length: ${version.length})`);
    
    return new NextResponse(version, {
        status: 200,
        headers: { 
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': version.length.toString(),
        },
    });
}
