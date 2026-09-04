import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JDownloaderLocalService, JDownloaderService } from '@/lib/services/jdownloader';
import { logger } from '@/lib/logger';
import { extractLinksFromPost } from '@/lib/services/link-extractor';
import { bencodeDecode, bencodeEncode, base64UrlToBuffer } from '@/lib/bencode';
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

function bufferToUtf8(value: unknown): string {
    if (Buffer.isBuffer(value)) return value.toString('utf8');
    if (typeof value === 'string') return value;
    return '';
}

function extractBtihFromMagnet(magnetUri: string): string | null {
    try {
        const magnetMatch = magnetUri.match(/magnet:\?(.+)$/);
        if (!magnetMatch) return null;
        const params = new URLSearchParams(magnetMatch[1]);
        const xt = params.get('xt') || '';
        const m = xt.match(/urn:btih:([A-Za-z0-9]+)/);
        if (!m) return null;
        const raw = m[1];
        // If already hex (40 chars), return.
        if (/^[a-fA-F0-9]{40}$/.test(raw)) return raw.toLowerCase();
        // If base32 (32 chars), convert to hex.
        if (/^[A-Z2-7]{32}$/.test(raw)) {
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            let bits = '';
            for (const ch of raw) {
                const val = alphabet.indexOf(ch);
                if (val < 0) return null;
                bits += val.toString(2).padStart(5, '0');
            }
            const bytes: number[] = [];
            for (let i = 0; i + 8 <= bits.length; i += 8) {
                bytes.push(parseInt(bits.slice(i, i + 8), 2));
            }
            return Buffer.from(bytes).toString('hex').slice(0, 40);
        }
        return null;
    } catch {
        return null;
    }
}

function isHexInfoHash(value: string): boolean {
    return /^[a-f0-9]{40}$/.test(value);
}

function stableHashHex(input: string): string {
    return crypto.createHash('sha1').update(Buffer.from(input, 'utf8')).digest('hex');
}

/**
 * POST /api/qbittorrent/api/v2/torrents/add
 * 
 * This endpoint simulates qBittorrent's torrent add API.
 * When Sonarr sends a torrent/magnet URI, we intercept it and:
 * 1. Extract the original forum link from the magnet URI
 * 2. Send the link to JDownloader
 * 3. Return a success response to keep Sonarr happy
 */
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || '';
        logger.info('qbittorrent', `POST /api/v2/torrents/add - Content-Type: ${contentType}`);

        // Parse form data (Sonarr sends multipart/form-data with "torrent" or "urls" field)
        const formData = await request.formData();

        // qBittorrent API uses the field name "torrents" (plural). Some clients use "torrent".
        const torrentFile = (formData.get('torrent') as File | null) || (formData.get('torrents') as File | null);
        const torrentFiles = formData.getAll('torrents').filter((v): v is File => v instanceof File);
        const urls = formData.get('urls') as string | null;
        const savepath = formData.get('savepath') as string | null;
        const category = formData.get('category') as string | null;

        logger.info('qbittorrent', `torrentFile: ${torrentFile ? torrentFile.name : 'null'}, urls: ${urls ? urls.substring(0, 100) : 'null'}, category: ${category}`);

        const arrType = detectArrService(request.headers.get('user-agent'));

        // Extract the actual link/magnet URI
        const magnetUri = urls || '';

        // Prefer files sent in "torrents" (plural) if present; fall back to the singular.
        const filesToProcess: File[] = torrentFiles.length > 0 ? torrentFiles : (torrentFile ? [torrentFile] : []);

        if (!magnetUri && filesToProcess.length === 0) {
            logger.warn('qbittorrent', 'No magnet URI or torrent file provided');
            return new NextResponse('Fail.', { status: 400 });
        }

        const allTorrentFileContents: Buffer[] = [];
        for (const f of filesToProcess) {
            const buf = Buffer.from(await f.arrayBuffer());
            allTorrentFileContents.push(buf);
            logger.info('qbittorrent', `Received torrent file: ${f.name} (${buf.length} bytes)`);
        }

        // Try to extract payload from .torrent (preferred for Sonarr)
        let forumUrl = '';
        let forumId = '';
        let title = '';
        let infoHash: string | null = null;
        let categoryFromPayload: string | undefined;

        for (const torrentFileContent of allTorrentFileContents) {
            try {
                const decoded = bencodeDecode(torrentFileContent);
                if (typeof decoded === 'object' && decoded && !Array.isArray(decoded) && !Buffer.isBuffer(decoded)) {
                    const dict = decoded as Record<string, any>;
                    const comment = bufferToUtf8(dict['comment']);
                    const info = dict['info'];
                    if (!infoHash && info && typeof info === 'object') {
                        const infoBuf = bencodeEncode(info as any);
                        infoHash = crypto.createHash('sha1').update(infoBuf).digest('hex');
                    }

                    if (!forumUrl && comment.startsWith('sweaterr:')) {
                        const b64url = comment.slice('sweaterr:'.length);
                        const payloadText = base64UrlToBuffer(b64url).toString('utf8');
                        const payload = JSON.parse(payloadText);
                        forumUrl = typeof payload.postUrl === 'string' ? payload.postUrl : '';
                        forumId = typeof payload.forumId === 'string' ? payload.forumId : '';
                        title = typeof payload.title === 'string' ? payload.title : '';
                        categoryFromPayload = typeof payload.category === 'string' ? payload.category : undefined;
                    }
                }
            } catch (error) {
                logger.warn('qbittorrent', `Failed to parse torrent file: ${error}`);
            }
        }

        // Extract the original forum link from the magnet URI
        // Format: magnet:?xt=urn:btih:INFOHASH&dn=TITLE&xs=FORUM_URL

        if (magnetUri) {
            try {
                // Parse magnet URI parameters
                const magnetMatch = magnetUri.match(/magnet:\?(.+)$/);
                if (magnetMatch) {
                    const params = new URLSearchParams(magnetMatch[1]);
                    forumUrl = params.get('xs') || ''; // xs = external source (our custom param with forum URL)
                    title = params.get('dn') || ''; // dn = display name (title)

                    if (forumUrl) {
                        forumUrl = decodeURIComponent(forumUrl);
                    }
                    if (title) {
                        title = decodeURIComponent(title);
                    }

                    infoHash = infoHash || extractBtihFromMagnet(magnetUri);
                }
            } catch (error) {
                logger.warn('qbittorrent', `Failed to parse magnet URI: ${error}`);
            }
        }

        logger.info('qbittorrent', `Processing torrent: title="${title}", forumUrl="${forumUrl}"`);

        // If we have a forum URL, extract direct links and send them to JDownloader
        if (forumUrl) {
            try {
                const jdConfig = await db.jDownloaderConfig.findFirst({ where: { enabled: true } });
                if (!jdConfig) {
                    logger.warn('qbittorrent', 'No JDownloader config found');
                } else {
                    // Resolve forum context
                    const forum = forumId
                        ? await db.forum.findUnique({ where: { id: forumId }, include: { credentials: true } })
                        : await db.forum.findFirst({
                            where: { enabled: true },
                            include: { credentials: true },
                        });

                    // If we didn't get a specific forumId, try to match by URL
                    let matchedForum = forum;
                    if (!forumId) {
                        const forums = await db.forum.findMany({ where: { enabled: true }, include: { credentials: true } });
                        matchedForum = forums.find((f) => forumUrl.startsWith(f.baseUrl)) || forums.find((f) => new URL(forumUrl).host === new URL(f.baseUrl).host) || null;
                    }

                    if (!matchedForum) {
                        logger.warn('qbittorrent', 'No matching forum found for URL; skipping extraction');
                    } else {
                        // Determine if FlareSolverr should be used for this forum
                        const flareUrl = (matchedForum.useFlaresolverr !== false && process.env.FLARESOLVERR_URL) ? process.env.FLARESOLVERR_URL : undefined;

                        const extractResult = await extractLinksFromPost(
                            forumUrl,
                            matchedForum.baseUrl,
                            matchedForum.credentials?.username,
                            matchedForum.credentials?.password,
                            flareUrl,
                            matchedForum.id,
                            {
                                thankButtonSelector: matchedForum.thankButtonSelector || undefined,
                                linksContainerSelector: matchedForum.linksContainerSelector || undefined,
                            }
                        );

                        if (!extractResult.success || !extractResult.links || extractResult.links.length === 0) {
                            logger.warn('qbittorrent', `Link extraction failed: ${extractResult.error || 'no links found'}`);
                        } else {
                            const links = extractResult.links;
                            const packageName = title || 'Sonarr';

                            const jdMode = (jdConfig.mode || 'local').toLowerCase();
                            const jdLocal = jdMode === 'local'
                                ? new JDownloaderLocalService(jdConfig.localHost || 'localhost', jdConfig.localPort || 3128)
                                : null;
                            const jdRemote = jdMode === 'cloud'
                                ? new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName)
                                : null;

                            let success = false;
                            if (jdLocal) {
                                success = await jdLocal.addLinks(links, packageName, true, true);
                                if (success) {
                                    await jdLocal.startDownloadController();
                                }
                            } else if (jdRemote) {
                                const authed = await jdRemote.authenticate();
                                if (authed) {
                                    success = await jdRemote.addLinks(links, packageName, true, true);
                                    if (success) {
                                        await jdRemote.moveLinkGrabberPackagesToDownloadsByName(packageName);
                                        await jdRemote.startDownloadController();
                                    }
                                }
                            }

                            if (success) {
                                logger.info('qbittorrent', `Successfully sent ${links.length} link(s) to JDownloader`);
                            } else {
                                logger.warn('qbittorrent', 'Failed to send links to JDownloader');
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error('qbittorrent', `Failed to process JDownloader flow: ${error}`);
            }
        }

        // Create/update a record in the database for tracking
        try {
            const grabKey = infoHash || (magnetUri ? Buffer.from(magnetUri).toString('base64url').substring(0, 50) : 'unknown');
            const normalizedHash = isHexInfoHash((grabKey || '').toLowerCase())
                ? (grabKey || '').toLowerCase()
                : stableHashHex(grabKey || 'unknown');
            const normalizedTitle = title || (magnetUri ? magnetUri.substring(0, 100) : 'Torrent from Sonarr');
            const normalizedCategory = category || categoryFromPayload || 'tv-sonarr';
            const normalizedStatus = forumUrl ? 'downloading' : 'pending';

            const existing = await db.download.findFirst({
                where: { grabId: normalizedHash },
                orderBy: { createdAt: 'desc' },
            });

            if (existing) {
                await db.download.update({
                    where: { id: existing.id },
                    data: {
                        title: normalizedTitle,
                        sourceUrl: forumUrl || magnetUri || existing.sourceUrl,
                        forumName: 'Sweaterr qBittorrent API',
                        status: normalizedStatus,
                        arrType,
                        category: normalizedCategory,
                        releaseTitle: normalizedTitle,
                        updatedAt: new Date(),
                    },
                });
                logger.info('qbittorrent', 'Updated existing download record for ARR grab');
            } else {
                await db.download.create({
                    data: {
                        title: normalizedTitle,
                        sourceUrl: forumUrl || magnetUri || '',
                        forumName: 'Sweaterr qBittorrent API',
                        status: normalizedStatus,
                        arrType,
                        grabId: normalizedHash,
                        category: normalizedCategory,
                        releaseTitle: normalizedTitle,
                        size: '0',
                    },
                });
                logger.info('qbittorrent', 'Created download record for ARR grab');
            }
        } catch (error) {
            logger.warn('qbittorrent', `Failed to create/update download record: ${error}`);
        }

        // Return success to keep Sonarr happy
        // qBittorrent API returns "Ok." on success, "Fail." on failure
        return new NextResponse('Ok.', { status: 200 });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('qbittorrent', `Error in /api/v2/torrents/add: ${errorMessage}`);
        return new NextResponse('Fail.', { status: 500 });
    }
}
