import { NextResponse } from 'next/server';
import { webcrypto } from 'node:crypto';

/**
 * Endpoint para debuggear autenticación MyJDownloader paso a paso
 * GET /api/config/jdownloader/debug-auth?email=...&password=...&device=...
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email') || 'malevolent@zoho.com';
        const password = searchParams.get('password') || 'Test123456';
        const deviceName = searchParams.get('device') || 'Samael';

        const logs: string[] = [];
        const log = (msg: string) => {
            console.log(msg);
            logs.push(msg);
        };

        log(`[Debug] Iniciando con email: ${email}`);
        log(`[Debug] Device: ${deviceName}`);

        // Helper: SHA256
        async function sha256(text: string): Promise<string> {
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // Helper: HMAC-SHA256
        async function hmacSha256(message: string, secret: string): Promise<string> {
            const encoder = new TextEncoder();
            const keyData = encoder.encode(secret);
            const messageData = encoder.encode(message);

            const cryptoKey = await webcrypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );

            const signature = await webcrypto.subtle.sign('HMAC', cryptoKey, messageData);
            const signatureArray = Array.from(new Uint8Array(signature));
            return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // Step 1: Generate secrets
        log('[Step 1] Generando secrets...');
        const loginSecret = await sha256(email.toLowerCase() + password + 'server');
        const deviceSecret = await sha256(email.toLowerCase() + password + 'device');
        log(`[Step 1] loginSecret: ${loginSecret}`);
        log(`[Step 1] deviceSecret: ${deviceSecret.substring(0, 16)}...`);

        // Step 2: Connect - Probando dos variantes de URL encoding
        log('[Step 2] Conectando a MyJDownloader...');
        const appkey = searchParams.get('appkey') || 'myjd_webextension_firefox'; // Del addon oficial
        log(`[Step 2] Usando appkey: ${appkey}`);

        // Variante 1: CON encodeURIComponent y rid=0 (siguiendo jdapi.js)
        // Probando orden alfabético: appkey, email, rid
        const connectQueryEncoded = `/my/connect?appkey=${appkey}&email=${encodeURIComponent(email.toLowerCase())}&rid=0`;
        const signatureEncoded = await hmacSha256(connectQueryEncoded, loginSecret);
        const connectUrlEncoded = `https://api.jdownloader.org${connectQueryEncoded}&signature=${signatureEncoded}`;

        // Variante 2: SIN encodeURIComponent y rid=0, orden alfabético
        const connectQueryPlain = `/my/connect?appkey=${appkey}&email=${email.toLowerCase()}&rid=0`;
        const signaturePlain = await hmacSha256(connectQueryPlain, loginSecret);
        const connectUrlPlain = `https://api.jdownloader.org${connectQueryPlain}&signature=${signaturePlain}`;

        log(`[Step 2] Probando Variante 1 (URL encoded, appkey=${appkey}, rid=0)...`);
        log(`[Step 2] Query: ${connectQueryEncoded}`);
        log(`[Step 2] Signature: ${signatureEncoded}`);

        let connectResponse = await fetch(connectUrlEncoded, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, */*',
                'Referer': 'https://my.jdownloader.org/',
            },
        });

        log(`[Step 2] Response status: ${connectResponse.status} ${connectResponse.statusText}`);

        if (!connectResponse.ok) {
            const errorText1 = await connectResponse.text();
            log(`[Step 2] Variante 1 falló: ${errorText1}`);
            log(`[Step 2] Probando Variante 2 (SIN URL encoding, rid=0)...`);
            log(`[Step 2] Query: ${connectQueryPlain}`);
            log(`[Step 2] Signature: ${signaturePlain}`);

            connectResponse = await fetch(connectUrlPlain, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            log(`[Step 2] Response status: ${connectResponse.status} ${connectResponse.statusText}`);
        }

        if (!connectResponse.ok) {
            const errorText = await connectResponse.text();
            log(`[Step 2] ERROR: ${errorText}`);
            return NextResponse.json({
                success: false,
                error: `Connect failed: ${connectResponse.status}`,
                errorBody: errorText,
                logs,
            });
        }

        const connectData = await connectResponse.json();
        log(`[Step 2] Connect response: ${JSON.stringify(connectData)}`);

        const sessionToken = connectData.sessiontoken;
        const regainToken = connectData.regaintoken;

        // Step 3: Derive encryption tokens
        log('[Step 3] Derivando tokens de encriptación...');
        const serverEncryptionToken = await sha256(sessionToken + loginSecret);
        const deviceEncryptionToken = await sha256(sessionToken + deviceSecret);
        log(`[Step 3] serverEncryptionToken: ${serverEncryptionToken.substring(0, 16)}...`);
        log(`[Step 3] deviceEncryptionToken: ${deviceEncryptionToken.substring(0, 16)}...`);

    } catch (error: any) {
        console.error('[Debug] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack,
        }, { status: 500 });
    }
}
