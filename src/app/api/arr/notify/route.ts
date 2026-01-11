import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// POST /api/arr/notify - Notification handler for *arr callbacks
// This endpoint receives webhooks from Sonarr/Radarr when downloads are imported
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    logger.info('arr-notify', `Notification received: ${JSON.stringify(body, null, 2)}`);

    // Extract relevant data from *arr webhook payload
    // Common fields: eventType, series/movie, release, downloadId
    const { eventType, downloadId, release } = body;

    if (!downloadId && !release?.guid) {
      logger.warn('arr-notify', 'No downloadId or GUID in notification payload');
      return NextResponse.json({
        success: true,
        message: 'Notification received but no download identifier found',
      });
    }

    // Find matching download by grabId (GUID from our indexer)
    const guid = release?.guid || downloadId;
    const download = await db.download.findFirst({
      where: { grabId: guid },
    });

    if (!download) {
      logger.warn('arr-notify', `No matching download found for GUID: ${guid}`);
      return NextResponse.json({
        success: true,
        message: 'Download not found',
      });
    }

    // Update download status based on event type
    let newStatus: string = download.status;
    
    switch (eventType) {
      case 'Grab':
        newStatus = 'downloading';
        break;
      case 'Download':
        newStatus = 'completed';
        break;
      case 'Rename':
        newStatus = 'completed';
        break;
      case 'Test':
        logger.info('arr-notify', 'Test notification received');
        return NextResponse.json({
          success: true,
          message: 'Test notification processed',
        });
      default:
        logger.info('arr-notify', `Unknown event type: ${eventType}`);
    }

    // Update download in database
    await db.download.update({
      where: { id: download.id },
      data: {
        status: newStatus,
        progress: newStatus === 'completed' ? 100 : download.progress,
      },
    });

    // Create notification record for history
    await db.arrNotification.create({
      data: {
        downloadId: download.id,
        eventType: eventType || 'Unknown',
        payload: JSON.stringify(body),
      },
    });

    logger.info('arr-notify', `Updated download ${download.id} to status: ${newStatus}`);
    
    return NextResponse.json({
      success: true,
      message: `Notification processed for ${eventType}`,
    });
  } catch (error) {
    logger.error('arr-notify', `Error processing notification: ${error}`);
    return NextResponse.json(
      { success: false, error: 'Notification processing failed' },
      { status: 500 }
    );
  }
}