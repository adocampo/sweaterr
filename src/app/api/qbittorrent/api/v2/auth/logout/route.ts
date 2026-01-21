import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/qbittorrent/api/v2/auth/logout
 */
export async function POST(request: NextRequest) {
    const userAgent = request.headers.get('user-agent') || 'unknown';
    logger.info('qbittorrent', `[auth] logout from ${userAgent}`);

    return new NextResponse('Ok.', {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
            'Set-Cookie': 'SID=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
        },
    });
}
