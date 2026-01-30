import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JDownloaderService, JDownloaderLocalService } from '@/lib/services/jdownloader';

export async function POST(req: NextRequest) {
    try {
        const { uuid, id, packageId } = await req.json();
        const linkId = id ?? uuid;
        if (!linkId) {
            return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }

        const jdConfig = await db.jDownloaderConfig.findFirst({ where: { enabled: true }, orderBy: { updatedAt: 'desc' } });
        if (!jdConfig) {
            return NextResponse.json({ success: false, error: 'JDownloader not configured' }, { status: 400 });
        }

        let ok = false;
        const jdMode = (jdConfig.mode || 'local').toLowerCase();

        if (jdMode === 'local') {
            // Use local JDownloader API
            if (!jdConfig.localHost || !jdConfig.localPort) {
                return NextResponse.json({ success: false, error: 'Local JDownloader config incomplete' }, { status: 400 });
            }
            const jdLocal = new JDownloaderLocalService(jdConfig.localHost, jdConfig.localPort);
            ok = await jdLocal.forceExtract([linkId], packageId ? [packageId] : undefined);
        } else {
            // Use cloud MyJDownloader API
            if (!jdConfig.email || !jdConfig.password || !jdConfig.deviceName) {
                return NextResponse.json({ success: false, error: 'Cloud JDownloader config incomplete' }, { status: 400 });
            }
            const jdService = new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName);
            const auth = await jdService.authenticate();
            if (!auth) return NextResponse.json({ success: false, error: 'Auth failed' }, { status: 401 });
            ok = await jdService.forceExtract([linkId], packageId ? [packageId] : undefined);
        }

        return NextResponse.json({ success: ok });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Failed to extract' }, { status: 500 });
    }
}
