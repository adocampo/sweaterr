import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { bencodeEncode, bufferToBase64Url } from '@/lib/bencode';
import crypto from 'node:crypto';

function detectArrService(userAgent: string | null): string {
    if (!userAgent) return 'unknown';
    const ua = userAgent.toLowerCase();
    if (ua.includes('sonarr')) return 'sonarr';
    if (ua.includes('radarr')) return 'radarr';
    if (ua.includes('lidarr')) return 'lidarr';
    if (ua.includes('readarr')) return 'readarr';
    if (ua.includes('prowlarr')) return 'prowlarr';
    if (ua.includes('whisparr')) return 'whisparr';
    return 'unknown';
}

// GET /api/arr/grab - Download link grab endpoint (Torznab-compatible)
// Uses forum's API key (torznabApiKey field) for validation
// Returns a real .torrent (bencoded) so Sonarr can pass it to a download client.
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const apiKey = searchParams.get('apikey') || request.headers.get('x-api-key');
        const arrType = detectArrService(request.headers.get('user-agent'));
        // Newznab clients typically send t=get&id=<guid>; support both 'id' and 'guid'
        const guid = searchParams.get('id') || searchParams.get('guid'); // format: base64url(JSON{forumId, category, url})

        if (!apiKey || !guid) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key or GUID"/>`,
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Validate API key against forum's stored API key (torznabApiKey)
        const forumWithApiKey = await db.forum.findFirst({
            where: { torznabApiKey: apiKey },
        });

        if (!forumWithApiKey || !forumWithApiKey.enabled) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Parse GUID (base64url encoded JSON)
        let forumId: string;
        let postUrl: string;
        let category: string | undefined;
        let title: string | undefined;

        try {
            const decoded = Buffer.from(guid, 'base64url').toString('utf-8');
            const guidData = JSON.parse(decoded);
            forumId = guidData.forumId;
            postUrl = guidData.url;
            category = typeof guidData.category === 'string' ? guidData.category : undefined;
            title = typeof guidData.title === 'string' ? guidData.title : undefined;
        } catch (parseError) {
            // Fallback: try old format (forumId-category-url) for backwards compatibility
            const parts = guid.split('-');
            if (parts.length < 3) {
                return new NextResponse(
                    `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Invalid GUID format"/>`,
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/xml' },
                    }
                );
            }
            forumId = parts[0];
            category = parts[1];
            postUrl = parts.slice(2).join('-'); // Skip category at index 1
        }

        if (!forumId || !postUrl) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Invalid GUID format"/>`,
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Load forum (for validation + metadata)
        const forum = await db.forum.findUnique({
            where: { id: forumId },
            include: { credentials: true },
        });

        if (!forum) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Forum not configured"/>`,
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Get package name (use title from GUID, fallback to forum name)
        const packageName = title || forum.name || 'Download';

        logger.info('arr_grab', `Grab requested (torrent) forum=${forum.name}, postUrl=${postUrl}, arrType=${arrType}`);

        // Build a real .torrent file (bencoded). We include a Sweaterr payload in the comment
        // so our qBittorrent-compatible endpoint can extract it later.
        const payload = {
            v: 1,
            guid,
            forumId,
            forumName: forum.name,
            postUrl,
            category: category || undefined,
            title: packageName,
            arrType,
        };

        const payloadB64Url = bufferToBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
        const pieceLength = 16384;
        const pieces = crypto.createHash('sha1').update(Buffer.from(guid, 'utf8')).digest();

        const torrent = {
            announce: 'udp://tracker.sweaterr.local:6969',
            'created by': 'Sweaterr',
            'creation date': Math.floor(Date.now() / 1000),
            comment: `sweaterr:${payloadB64Url}`,
            info: {
                name: packageName.replace(/[\r\n]+/g, ' ').slice(0, 250),
                'piece length': pieceLength,
                pieces,
                length: 1,
            },
        };

        const torrentBuffer = bencodeEncode(torrent as any);

        return new NextResponse(new Uint8Array(torrentBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/x-bittorrent',
                'Content-Disposition': `attachment; filename="${packageName.replace(/[^a-zA-Z0-9]/g, '_')}.torrent"`,
            },
        });
    } catch (error) {
        logger.error('arr_grab', 'Error in grab endpoint', error);
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
