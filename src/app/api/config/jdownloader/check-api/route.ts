import { NextResponse } from 'next/server';

/**
 * Test simple: Verifica que my.jdownloader.org es accesible
 * GET /api/config/jdownloader/check-api
 */
export async function GET() {
    const tests: any[] = [];

    // Test 1: Check if API is reachable
    try {
        const res = await fetch('https://api.jdownloader.org/my/connect', {
            method: 'OPTIONS',
        });
        tests.push({
            name: 'API reachable (OPTIONS)',
            status: res.status,
            ok: res.status < 500,
        });
    } catch (e: any) {
        tests.push({
            name: 'API reachable (OPTIONS)',
            status: 'ERROR',
            ok: false,
            error: e.message,
        });
    }

    // Test 2: Test with intentionally wrong creds to see if API responds
    try {
        const res = await fetch('https://api.jdownloader.org/my/connect?email=test@test.com&appkey=DEMOAPIAPP&rid=12345&signature=invalidsignature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const data = await res.text();
        tests.push({
            name: 'API responds to POST (with invalid sig)',
            status: res.status,
            ok: res.status >= 400 && res.status < 500,
            response: data.substring(0, 100),
        });
    } catch (e: any) {
        tests.push({
            name: 'API responds to POST',
            status: 'ERROR',
            ok: false,
            error: e.message,
        });
    }

    // Test 3: Try with POST body instead of query string
    try {
        const res = await fetch('https://api.jdownloader.org/my/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'email=test@test.com&appkey=DEMOAPIAPP&rid=12345&signature=invalidsignature',
        });
        const data = await res.text();
        tests.push({
            name: 'API with form-urlencoded body',
            status: res.status,
            ok: res.status >= 400 && res.status < 500,
            response: data.substring(0, 100),
        });
    } catch (e: any) {
        tests.push({
            name: 'API with form-urlencoded body',
            status: 'ERROR',
            ok: false,
            error: e.message,
        });
    }

    return NextResponse.json({ tests });
}
