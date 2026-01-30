import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { JDownloaderLocalService, JDownloaderService } from '@/lib/services/jdownloader';

const payloadSchema = z.object({
    links: z.array(z.string().url()).min(1, 'Se requiere al menos un enlace'),
    packageName: z.string().optional(),
    jdId: z.string().optional(),
    autostart: z.boolean().optional(),
    autoExtract: z.boolean().optional(),
});

// POST /api/testing/jdownloader/add-links
// Enviar enlaces ya extraídos a JDownloader (usa instancia habilitada o id específico)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { links, packageName, jdId, autostart, autoExtract } = payloadSchema.parse(body);

        // Seleccionar instancia de JD (prioriza id, luego habilitada, luego la primera)
        const jdConfig = jdId
            ? await db.jDownloaderConfig.findUnique({ where: { id: jdId } })
            : await db.jDownloaderConfig.findFirst({ where: { enabled: true }, orderBy: { createdAt: 'desc' } })
            ?? await db.jDownloaderConfig.findFirst({ orderBy: { createdAt: 'desc' } });

        if (!jdConfig) {
            return NextResponse.json({ success: false, error: 'No hay instancias de JDownloader configuradas' }, { status: 400 });
        }

        let added = false;
        if (jdConfig.mode === 'local') {
            if (!jdConfig.localHost || !jdConfig.localPort) {
                return NextResponse.json({ success: false, error: 'Instancia local incompleta (host/port)' }, { status: 400 });
            }
            const local = new JDownloaderLocalService(jdConfig.localHost, jdConfig.localPort);
            const available = await local.isAvailable();
            if (!available) {
                return NextResponse.json({ success: false, error: 'JDownloader local no responde' }, { status: 400 });
            }
            added = await local.addLinks(links, packageName, autostart, autoExtract);
        } else {
            if (!jdConfig.email || !jdConfig.password || !jdConfig.deviceName) {
                return NextResponse.json({ success: false, error: 'Instancia cloud incompleta (email/password/deviceName)' }, { status: 400 });
            }
            const remote = new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName);
            const authed = await remote.authenticate();
            if (!authed) {
                return NextResponse.json({ success: false, error: 'No se pudo autenticar con MyJDownloader' }, { status: 400 });
            }
            added = await remote.addLinks(links, packageName, autostart, autoExtract);
        }

        if (!added) {
            return NextResponse.json({ success: false, error: 'No se pudieron enviar los enlaces a JDownloader' }, { status: 500 });
        }

        return NextResponse.json({ success: true, addedCount: links.length, jdId: jdConfig.id });
    } catch (error) {
        console.error('[Testing/JD] Error enviando enlaces:', error);
        return NextResponse.json({ success: false, error: 'Error al enviar enlaces a JDownloader' }, { status: 500 });
    }
}
