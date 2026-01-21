import { NextResponse } from 'next/server';

/**
 * GET /api/qbittorrent/api/v2/app/version
 * Some clients query this. Return a plausible qBittorrent version.
 */
export async function GET() {
    return new NextResponse('4.6.3', {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
        },
    });
}
