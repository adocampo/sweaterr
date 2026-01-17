import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JDownloaderLocalService, JDownloaderService } from '@/lib/services/jdownloader';
import { logger } from '@/lib/logger';

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
        
        const torrentFile = formData.get('torrent') as File | null;
        const urls = formData.get('urls') as string | null;
        const savepath = formData.get('savepath') as string | null;
        const category = formData.get('category') as string | null;

        logger.info('qbittorrent', `torrentFile: ${torrentFile ? torrentFile.name : 'null'}, urls: ${urls ? urls.substring(0, 100) : 'null'}, category: ${category}`);

        // Extract the actual link/magnet URI
        let magnetUri = urls || '';
        let torrentFileContent: Buffer | null = null;

        if (torrentFile) {
            torrentFileContent = Buffer.from(await torrentFile.arrayBuffer());
            logger.info('qbittorrent', `Received torrent file: ${torrentFile.name} (${torrentFileContent.length} bytes)`);
        }

        if (!magnetUri && !torrentFileContent) {
            logger.warn('qbittorrent', 'No magnet URI or torrent file provided');
            return new NextResponse('Fail.', { status: 400 });
        }

        // Extract the original forum link from the magnet URI
        // Format: magnet:?xt=urn:btih:INFOHASH&dn=TITLE&xs=FORUM_URL
        let forumUrl = '';
        let title = '';
        
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
                }
            } catch (error) {
                logger.warn('qbittorrent', `Failed to parse magnet URI: ${error}`);
            }
        }

        logger.info('qbittorrent', `Processing torrent: title="${title}", forumUrl="${forumUrl}"`);

        // If we have a forum URL, send it to JDownloader
        if (forumUrl) {
            try {
                const jdConfig = await db.jDownloaderConfig.findFirst({ where: { enabled: true } });
                
                if (!jdConfig) {
                    logger.warn('qbittorrent', 'No JDownloader config found');
                    // Continue anyway - log the link for manual processing
                } else {
                    let success = false;
                    
                    if (jdConfig.mode === 'local') {
                        const jdService = new JDownloaderLocalService(
                            jdConfig.localHost || 'localhost',
                            jdConfig.localPort || 3128
                        );
                        success = await jdService.addLinks([forumUrl], category || 'Sonarr');
                    } else {
                        const jdService = new JDownloaderService(
                            jdConfig.email || '',
                            jdConfig.password || '',
                            jdConfig.deviceName || ''
                        );
                        success = await jdService.addLinks([forumUrl], category || 'Sonarr');
                    }
                    
                    if (success) {
                        logger.info('qbittorrent', `Successfully sent link to JDownloader: ${forumUrl}`);
                    } else {
                        logger.warn('qbittorrent', `Failed to send link to JDownloader: ${forumUrl}`);
                    }
                }
            } catch (error) {
                logger.error('qbittorrent', `Failed to send link to JDownloader: ${error}`);
                // Continue anyway - don't block the response to Sonarr
            }
        }
        
        // Create a record in the database for tracking
        try {
            await db.download.create({
                data: {
                    title: title || (magnetUri ? magnetUri.substring(0, 100) : 'Torrent from Sonarr'),
                    sourceUrl: forumUrl || magnetUri || '',
                    forumName: 'Sweaterr qBittorrent API',
                    status: forumUrl ? 'downloading' : 'pending', // downloading if sent to JD, pending if no URL
                    arrType: 'sonarr', // Track this came from Sonarr
                    grabId: magnetUri ? Buffer.from(magnetUri).toString('base64url').substring(0, 50) : 'unknown',
                    category: category || 'tv-sonarr',
                    size: '0',
                },
            });
            logger.info('qbittorrent', 'Created download record for Sonarr grab');
        } catch (error) {
            logger.warn('qbittorrent', `Failed to create download record: ${error}`);
            // Continue anyway - don't block the response
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
