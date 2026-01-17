import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    const userAgent = request.headers.get('user-agent');
    const authHeader = request.headers.get('authorization');
    
    logger.info('qbittorrent', `GET /api/v2/app/webapiVersion from ${userAgent}`);
    logger.info('qbittorrent', `Auth header: ${authHeader ? 'present' : 'absent'}`);
    
    // Validate basic auth if provided (accept any credentials for testing)
    if (authHeader) {
        const authType = authHeader.split(' ')[0];
        if (authType.toLowerCase() === 'basic') {
            logger.info('qbittorrent', 'Basic auth provided, accepting...');
        }
    }
    
    // qBittorrent v4.1.0+ returns just the API version (e.g., "2.8.3")
    // Must be plain text with no extra whitespace or charset
    const version = '2.8.3';
    
    logger.info('qbittorrent', `Returning version: "${version}" (length: ${version.length})`);
    
    return new NextResponse(version, {
        status: 200,
        headers: { 
            'Content-Type': 'text/plain',
        },
    });
}
