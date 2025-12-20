import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JDownloaderService } from '@/lib/services/jdownloader';

export async function POST(req: NextRequest) {
    try {
        const { uuid, id, source, packageId } = await req.json();
        const linkId = id ?? uuid;
        if (!linkId) {
            return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }

        const jdConfig = await db.jDownloaderConfig.findFirst({ where: { enabled: true }, orderBy: { updatedAt: 'desc' } });
        if (!jdConfig || !jdConfig.email || !jdConfig.password || !jdConfig.deviceName) {
            return NextResponse.json({ success: false, error: 'JDownloader not configured' }, { status: 400 });
        }

        const jdService = new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName);
        const auth = await jdService.authenticate();
        if (!auth) return NextResponse.json({ success: false, error: 'Auth failed' }, { status: 401 });

        console.log('[API resume] linkId:', linkId, 'source:', source, 'packageId:', packageId);

        // If source is linkgrabber, move to download list instead of resuming
        const ok = source === 'linkgrabber'
            ? await jdService.moveToDownloadList([linkId], packageId ? [packageId] : undefined)
            : await jdService.resumeDownloads([linkId]);
        return NextResponse.json({ success: ok });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Failed to resume download' }, { status: 500 });
    }
}
