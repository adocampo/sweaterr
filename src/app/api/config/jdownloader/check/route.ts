import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { JDownloaderLocalService, JDownloaderService } from '@/lib/services/jdownloader';

const testPayloadSchema = z.discriminatedUnion('mode', [
    z.object({
        mode: z.literal('local'),
        localHost: z.string().min(1),
        localPort: z.number().min(1),
        link: z.string().url().optional(),
        packageName: z.string().optional(),
        autostart: z.boolean().optional(),
        autoExtract: z.boolean().optional(),
    }),
    z.object({
        mode: z.literal('cloud'),
        email: z.string().email(),
        password: z.string().min(1),
        deviceName: z.string().min(1),
        link: z.string().url().optional(),
        packageName: z.string().optional(),
        autostart: z.boolean().optional(),
        autoExtract: z.boolean().optional(),
    }),
]);

// POST /api/config/jdownloader/check - Check JDownloader connection and optionally add links
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const payload = testPayloadSchema.parse(body);

        let isConnected = false;
        let linkAdded = false;
        let linkError: string | null = null;

        // Test connection
        if (payload.mode === 'local') {
            const local = new JDownloaderLocalService(payload.localHost, payload.localPort);
            isConnected = await local.isAvailable();

            // If connected and link provided, try to add it
            if (isConnected && payload.link) {
                try {
                    linkAdded = await local.addLinks(
                        [payload.link],
                        payload.packageName,
                        payload.autostart ?? false,
                        payload.autoExtract ?? false
                    );
                } catch (err) {
                    linkError = err instanceof Error ? err.message : 'Failed to add link';
                }
            }
        } else if (payload.mode === 'cloud') {
            const remote = new JDownloaderService(payload.email, payload.password, payload.deviceName);
            isConnected = await remote.authenticate();

            // If connected and link provided, try to add it
            if (isConnected && payload.link) {
                try {
                    linkAdded = await remote.addLinks(
                        [payload.link],
                        payload.packageName
                    );
                } catch (err) {
                    linkError = err instanceof Error ? err.message : 'Failed to add link';
                }
            }
        }

        if (!isConnected) {
            const errorMsg =
                payload.mode === 'local'
                    ? `No se pudo conectar a JDownloader en ${payload.localHost}:${payload.localPort}`
                    : 'No se pudo autenticar con MyJDownloader';

            return NextResponse.json(
                { success: false, error: errorMsg },
                { status: 400 }
            );
        }

        // Connection successful
        const response: any = {
            success: true,
            message: 'Connection test successful',
        };

        // Add link info if link was attempted
        if (payload.link) {
            response.linkAdded = linkAdded;
            if (linkError) {
                response.linkError = linkError;
            }
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error testing JDownloader connection:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to test JDownloader connection',
            },
            { status: 500 }
        );
    }
}
