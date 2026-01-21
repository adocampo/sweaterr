import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { logger } from '@/lib/logger';

/**
 * POST /api/qbittorrent/api/v2/auth/login
 * qBittorrent-compatible auth endpoint.
 * Sonarr expects plain text ("Ok." / "Fails.") and a SID cookie.
 */
export async function POST(request: NextRequest) {
    const userAgent = request.headers.get('user-agent') || 'unknown';
    logger.info('qbittorrent', `[auth] login from ${userAgent}`);

    // We accept any credentials (this API is already publicly accessible via middleware).
    // This is purely for compatibility with clients expecting the endpoint to exist.
    const sid = crypto.randomBytes(16).toString('hex');

    const response = new NextResponse('Ok.', {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
            'Set-Cookie': `SID=${sid}; Path=/; HttpOnly; SameSite=Lax`,
        },
    });

    return response;
}
