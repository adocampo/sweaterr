import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

/**
 * Endpoint para debuggear autenticación MyJDownloader usando CryptoJS (como addon oficial)
 * GET /api/config/jdownloader/debug-auth-cryptojs?email=...&password=...&device=...
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email') || 'email@example.com';
        const password = searchParams.get('password') || 'Test123456';
        const deviceName = searchParams.get('device') || 'ServerName';
        const appkey = searchParams.get('appkey') || 'myjd_webextension_firefox';

        const logs: string[] = [];
        const log = (msg: string) => {
            console.log(msg);
            logs.push(msg);
        };

        log(`[Debug] Iniciando con email: ${email}`);
        log(`[Debug] Device: ${deviceName}`);
        log(`[Debug] AppKey: ${appkey}`);

        // Step 1: Generate login secret (as WordArray, like Firefox addon)
        log('[Step 1] Generando login secret como WordArray...');
        const loginSecret = CryptoJS.SHA256(
            CryptoJS.enc.Utf8.parse(email.toLowerCase() + password + 'server')
        );
        log(`[Step 1] loginSecret (hex): ${loginSecret.toString()}`);
        log(`[Step 1] loginSecret type: WordArray`);

        // Step 2: Build query with alphabetical order (appkey, email, rid)
        log('[Step 2] Construyendo query string con orden alfabético...');
        const queryString = `/my/connect?appkey=${appkey}&email=${encodeURIComponent(email.toLowerCase())}&rid=0`;
        log(`[Step 2] Query: ${queryString}`);

        // Step 3: Calcular HMAC con WordArray key (como addon oficial)
        log('[Step 3] Calculando firma HMAC-SHA256 con WordArray...');
        const hmac = CryptoJS.HmacSHA256(CryptoJS.enc.Utf8.parse(queryString), loginSecret);
        const signature = hmac.toString(CryptoJS.enc.Hex);
        log(`[Step 3] Signature: ${signature}`);

        // Step 4: Make request
        log('[Step 4] Haciendo solicitud a MyJDownloader...');
        const url = `https://api.jdownloader.org${queryString}&signature=${signature}`;
        log(`[Step 4] URL: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });

        log(`[Step 4] Response Status: ${response.status} ${response.statusText}`);
        const body = await response.text();
        log(`[Step 4] Response body length: ${body.length} chars`);
        log(`[Step 4] Response (first 100 chars): ${body.substring(0, 100)}`);

        if (response.ok) {
            // Try to decrypt response
            log('[Step 5] Intentando desencriptar respuesta AES-CBC...');
            try {
                const secretHex = loginSecret.toString();
                const iv = CryptoJS.enc.Hex.parse(secretHex.substring(0, 32));
                const key = CryptoJS.enc.Hex.parse(secretHex.substring(32));

                const decrypted = CryptoJS.AES.decrypt(
                    { ciphertext: CryptoJS.enc.Base64.parse(body) },
                    key,
                    { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
                );

                const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
                const data = JSON.parse(decryptedText);
                log(`[Step 5] ✅ Desencriptado exitosamente`);
                log(`[Step 5] sessiontoken: ${data.sessiontoken?.substring(0, 20)}...`);
                log(`[Step 5] rid: ${data.rid}`);

                return NextResponse.json({
                    success: true,
                    data,
                    logs,
                });
            } catch (error: any) {
                log(`[Step 5] ❌ Error al desencriptar: ${error.message}`);
                return NextResponse.json({
                    success: false,
                    error: 'Failed to decrypt response',
                    logs,
                }, { status: 400 });
            }
        } else {
            log(`[Error] ${body}`);
            return NextResponse.json({
                success: false,
                error: `HTTP ${response.status}`,
                errorBody: body,
                logs,
            }, { status: response.status });
        }
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
