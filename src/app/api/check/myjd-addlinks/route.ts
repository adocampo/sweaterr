import { NextResponse } from 'next/server';
import { JDownloaderService } from '@/lib/services/jdownloader';

/**
 * Check MyJDownloader addLinks with different parameter combinations
 * GET /api/check/myjd-addlinks
 */
export async function GET() {
    try {
        const email = 'malevolent@zoho.com';
        const password = 'Test123456';
        const deviceName = 'Samael';

        console.log('[Test] Testing MyJD addLinks...');

        const jdService = new JDownloaderService(email, password, deviceName);
        const authSuccess = await jdService.authenticate();

        if (!authSuccess) {
            return NextResponse.json({
                success: false,
                error: 'Authentication failed',
            }, { status: 401 });
        }

        // Test: List linkgrabber links first (to verify session is valid)
        console.log('\n=== Testing linkgrabber query first ===');
        const queryTest = await testQuery(jdService);

        // Test 1: Minimal parameters
        console.log('\n=== Test 1: Minimal parameters ===');
        const test1 = await testAddLinks(jdService, {
            links: 'https://proof.ovh.net/files/1Mb.dat',
        });

        // Test 2: With package name
        console.log('\n=== Test 2: With package name ===');
        const test2 = await testAddLinks(jdService, {
            links: 'https://proof.ovh.net/files/1Mb.dat',
            packageName: 'TestPackage',
        });

        // Test 3: Full parameters
        console.log('\n=== Test 3: Full parameters ===');
        const test3 = await testAddLinks(jdService, {
            links: 'https://proof.ovh.net/files/1Mb.dat',
            packageName: 'TestPackage',
            priority: 'DEFAULT',
            autostart: false,
            extractAfterDownload: false,
        });

        return NextResponse.json({
            success: true,
            queryTest,
            tests: {
                minimal: test1,
                withPackage: test2,
                full: test3,
            },
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

async function testQuery(service: any) {
    const CryptoJS = require('crypto-js');

    try {
        const rid = Date.now();
        const action = `/t_${service.deviceId}_${service.sessionToken}/linkgrabberv2/queryLinks`;
        const queryString = `${action}?rid=${rid}`;

        const hmac = CryptoJS.HmacSHA256(
            CryptoJS.enc.Utf8.parse(queryString),
            service.deviceEncryptionToken
        );
        const signature = hmac.toString(CryptoJS.enc.Hex);
        const url = `https://api.jdownloader.org${queryString}&signature=${signature}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({}),
        });

        const status = response.status;
        const body = await response.text();

        console.log('Query status:', status);
        console.log('Query response:', body.substring(0, 200));

        return {
            status,
            ok: response.ok,
            body: body.substring(0, 500),
        };
    } catch (error: any) {
        return {
            status: 'error',
            error: error.message,
        };
    }
}

async function testAddLinks(service: any, params: any) {
    const CryptoJS = require('crypto-js');

    try {
        const rid = Date.now();
        const action = `/t_${service.deviceId}_${service.sessionToken}/linkgrabberv2/addLinks`;
        const queryString = `${action}?rid=${rid}`;

        // Calculate signature
        const hmac = CryptoJS.HmacSHA256(
            CryptoJS.enc.Utf8.parse(queryString),
            service.deviceEncryptionToken
        );
        const signature = hmac.toString(CryptoJS.enc.Hex);
        const url = `https://api.jdownloader.org${queryString}&signature=${signature}`;

        console.log('Params:', JSON.stringify(params));
        console.log('URL:', url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(params),
        });

        const status = response.status;
        const body = await response.text();

        console.log('Status:', status);
        console.log('Response:', body.substring(0, 200));

        return {
            status,
            ok: response.ok,
            body: body.substring(0, 500),
        };
    } catch (error: any) {
        console.error('Test error:', error.message);
        return {
            status: 'error',
            error: error.message,
        };
    }
}
