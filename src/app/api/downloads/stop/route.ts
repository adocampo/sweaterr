import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JDownloaderService } from '@/lib/services/jdownloader';

export async function POST(req: NextRequest) {
    try {
        const { uuid, id, source, removeFiles, packageId } = await req.json();
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

        // Use appropriate endpoint based on source
        const ok = source === 'linkgrabber'
            ? await jdService.removeLinkGrabberLinks([linkId], packageId ? [packageId] : undefined)
            : await jdService.deleteDownloads([linkId], Boolean(removeFiles), packageId ? [packageId] : undefined);
        return NextResponse.json({ success: ok });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Failed to stop download' }, { status: 500 });
    }
}
