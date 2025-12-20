import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JDownloaderService } from '@/lib/services/jdownloader';

export async function POST(req: NextRequest) {
    try {
        const { uuid, id, path, packageId, source } = await req.json();
        const linkId = id ?? uuid;
        if (!linkId || !path) {
            return NextResponse.json({ success: false, error: 'id and path are required' }, { status: 400 });
        }

        const jdConfig = await db.jDownloaderConfig.findFirst({ where: { enabled: true }, orderBy: { updatedAt: 'desc' } });
        if (!jdConfig || !jdConfig.email || !jdConfig.password || !jdConfig.deviceName) {
            return NextResponse.json({ success: false, error: 'JDownloader not configured' }, { status: 400 });
        }

        const jdService = new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName);
        const auth = await jdService.authenticate();
        if (!auth) return NextResponse.json({ success: false, error: 'Auth failed' }, { status: 401 });

        console.log('[API path] linkId:', linkId, 'path:', path, 'packageId:', packageId, 'source:', source);

        const ok = await jdService.setDownloadPath([linkId], path, packageId ? [packageId] : undefined, source);
        return NextResponse.json({ success: ok });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Failed to set path' }, { status: 500 });
    }
}
