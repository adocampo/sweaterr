import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

function parseHashes(body: string): string[] {
    const params = new URLSearchParams(body);
    const hashes = params.get('hashes') || '';
    return hashes
        .split('|')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * POST /api/qbittorrent/api/v2/torrents/resume
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const hashes = parseHashes(body);
        logger.info('qbittorrent', `[torrents] resume hashes=${hashes.length}`);

        if (hashes.length) {
            await db.download.updateMany({
                where: { grabId: { in: hashes } },
                data: { status: 'downloading' },
            });
        }

        return new NextResponse('Ok.', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    } catch (error) {
        logger.error('qbittorrent', `[torrents] resume error: ${String(error)}`);
        return new NextResponse('Fail.', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
}
