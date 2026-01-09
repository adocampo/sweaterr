import { NextResponse } from 'next/server';
import { JDownloaderService } from '@/lib/services/jdownloader';
import { db } from '@/lib/db';

/**
 * Check MyJDownloader authentication (JDownloaderService)
 * GET /api/check/myjd-auth
 */
export async function GET() {
    try {
        // Use test credentials for now
        const email = 'malevolent@zoho.com';
        const password = 'Test123456';
        const deviceName = 'Samael';

        console.log('[Test] Testando JDownloaderService...');
        console.log('[Test] Email:', email);
        console.log('[Test] Device:', deviceName);

        // Create and authenticate
        const jdService = new JDownloaderService(
            email,
            password,
            deviceName
        );

        const authSuccess = await jdService.authenticate();

        if (!authSuccess) {
            return NextResponse.json({
                success: false,
                error: 'Authentication failed',
            }, { status: 401 });
        }

        // Try to add a test link with autostart and autoExtract
        const testUrls = [
            'https://proof.ovh.net/files/100Mb.dat', // Test file from OVH
        ];
        const testSuccess = await jdService.addLinks(
            testUrls,
            'Test Package',
            true,  // autostart
            false  // autoExtract
        );

        return NextResponse.json({
            success: true,
            message: 'Authentication successful',
            testLinkAdded: testSuccess,
            testUrls,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error.message,
            },
            { status: 500 }
        );
    }
}
