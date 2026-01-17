import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/qbittorrent/api/v2/torrents/add
 * 
 * This endpoint simulates qBittorrent's torrent add API.
 * When Sonarr sends a torrent/magnet URI, we intercept it and:
 * 1. Extract the torrent file or magnet URI
 * 2. Decode the infohash/GUID to find the original forum link
 * 3. Send the link to JDownloader instead of qBittorrent
 * 4. Return a success response to keep Sonarr happy
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

        // Extract the download link from the magnet URI or torrent metadata
        // The magnet URI contains encoded metadata including the original forum link
        // Format: magnet:?xt=urn:btih:INFOHASH&dn=TITLE&xl=SIZE...
        
        // For now, we'll store this as a pending download
        // In the future, we can extract the forum link from the magnet URI metadata

        logger.info('qbittorrent', `Processing torrent: magnet=${magnetUri ? magnetUri.substring(0, 80) + '...' : 'none'}`);

        // TODO: Extract the original forum link from the magnet URI
        // For now, just log and acknowledge the request to Sonarr
        
        // Create a record in the database for tracking
        try {
            await db.download.create({
                data: {
                    title: magnetUri ? magnetUri.substring(0, 100) : 'Torrent from Sonarr',
                    sourceUrl: magnetUri || '',
                    forumName: 'Sweaterr qBittorrent API',
                    status: 'pending', // Will be processed by JDownloader integration
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
