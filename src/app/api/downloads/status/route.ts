import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JDownloaderLocalService, JDownloaderService } from '@/lib/services/jdownloader';

// GET /api/downloads/status - Get download status from JDownloader
export async function GET() {
  try {
    const jdConfig = await db.jDownloaderConfig.findFirst({
      where: { enabled: true },
      orderBy: { updatedAt: 'desc' }
    });

    if (!jdConfig) {
      return NextResponse.json({
        success: false,
        error: 'JDownloader not configured',
      });
    }

    // If configured for local mode, skip status polling
    // Local API no soporta polling de estado de descargas de forma confiable
    if (jdConfig.mode === 'local') {
      return NextResponse.json({ success: true, data: [] });
    }

    if (!jdConfig.email || !jdConfig.password || !jdConfig.deviceName) {
      return NextResponse.json({
        success: false,
        error: 'JDownloader cloud credentials not configured',
      });
    }

    const jdService = new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName);

    // Authenticate
    const authSuccess = await jdService.authenticate();
    if (!authSuccess) {
      return NextResponse.json({
        success: false,
        error: 'Failed to authenticate with JDownloader',
      });
    }

    // Get downloads from JDownloader
    const jdDownloads = await jdService.getDownloads();

    // Sync JDownloader status with our database
    // Create or update download records for all JDownloader downloads
    for (const jdDownload of jdDownloads) {
      const mappedStatus = 
        jdDownload.status === 'finished' ? 'completed' :
        jdDownload.status === 'running' ? 'downloading' :
        jdDownload.status === 'failed' ? 'failed' : 'pending';
      
      // Try to find existing download by uuid
      const existingDownload = await db.download.findFirst({
        where: { jDownloaderId: jdDownload.uuid }
      });

      if (existingDownload) {
        // Update existing download
        await db.download.update({
          where: { id: existingDownload.id },
          data: {
            status: mappedStatus,
            progress: (jdDownload.progress / 100) || 0,
            size: jdDownload.size ? `${(jdDownload.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : undefined,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new download record if it doesn't exist
        // This can happen if JDownloader has downloads but we don't have them in DB
        await db.download.create({
          data: {
            title: jdDownload.name,
            sourceUrl: '',
            forumName: 'JDownloader',
            jDownloaderId: jdDownload.uuid,
            status: mappedStatus,
            progress: (jdDownload.progress / 100) || 0,
            size: jdDownload.size ? `${(jdDownload.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : undefined,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: jdDownloads,
    });

  } catch (error: any) {
    console.error('Error getting download status:', error);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to get download status' },
      { status: 500 }
    );
  }
}