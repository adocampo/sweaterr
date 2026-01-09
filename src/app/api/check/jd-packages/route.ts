import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JDownloaderService } from '@/lib/services/jdownloader';

// GET /api/check/jd-packages - Check getting packages from JDownloader
export async function GET() {
    try {
        const jdConfig = await db.jDownloaderConfig.findFirst({
            where: { enabled: true },
            orderBy: { updatedAt: 'desc' }
        });

        if (!jdConfig || !jdConfig.email || !jdConfig.password || !jdConfig.deviceName) {
            return NextResponse.json({
                success: false,
                error: 'JDownloader not configured',
            });
        }

        const jd = new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName);

        console.log('[Test] Authenticating...');
        const authSuccess = await jd.authenticate();

        if (!authSuccess) {
            return NextResponse.json({
                success: false,
                error: 'Authentication failed',
            });
        }

        console.log('[Test] Getting downloads...');
        const downloads = await jd.getDownloads();

        return NextResponse.json({
            success: true,
            count: downloads.length,
            downloads: downloads,
        });

    } catch (error: any) {
        console.error('[Test] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
