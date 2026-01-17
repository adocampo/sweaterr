import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    logger.info('qbittorrent', 'GET /api/v2/app/webapiVersion');
    
    // Return a simple version string
    // System.Version.Parse() is very strict - use only major.minor
    return new NextResponse('2.9', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
    });
}
