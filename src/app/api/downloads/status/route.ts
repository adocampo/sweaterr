import { NextResponse } from 'next/server';
import { getCachedDownloads, startDownloadsWarmup } from '@/lib/services/downloads-cache';

// Ensure the background warm-up loop is running (idempotent)
startDownloadsWarmup();

// GET /api/downloads/status - Get download status from the server-side cache.
// The cache is refreshed in the background on startup, on config save, and
// periodically, so this endpoint responds instantly instead of authenticating
// with MyJDownloader on every client poll.
export async function GET() {
  try {
    const { downloads, configured } = await getCachedDownloads();

    if (!configured) {
      return NextResponse.json({
        success: false,
        error: 'JDownloader not configured',
      });
    }

    return NextResponse.json({
      success: true,
      data: downloads,
    });
  } catch (error: any) {
    console.error('Error getting download status:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to get download status' },
      { status: 500 }
    );
  }
}
