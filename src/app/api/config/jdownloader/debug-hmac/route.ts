import { NextResponse } from 'next/server';
import { webcrypto } from 'node:crypto';

/**
 * Endpoint para debuggear el HMAC signature en detalle
 * Prueba diferentes variantes de firmado
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email') || 'email@example.com';
        const password = searchParams.get('password') || 'Test123456';
        const rid = Date.now().toString();

        const logs: string[] = [];
        const log = (msg: string) => {
            console.log(msg);
            logs.push(msg);
        };

        log(`=== HMAC SIGNATURE DEBUG ===`);
        log(`Email: ${email}`);
        log(`Password: ${password}`);
        log(`RID: ${rid}`);

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

        // Generate secrets with different email cases
        log(`\n[SECRETS] Probando diferentes capitalizaciones de email...`);

        const emailLower = email.toLowerCase();
        const emailOriginal = email;

        const secret1 = await sha256(emailLower + password + 'server');
        log(`[SECRETS-1] ${emailLower} + ${password} + 'server' = ${secret1}`);

        const secret2 = await sha256(emailOriginal + password + 'server');
        log(`[SECRETS-2] ${emailOriginal} + ${password} + 'server' = ${secret2}`);

        // Test different query formats
        log(`\n[QUERY] Probando diferentes formatos de query...`);

        const queries = [
            // Formato 1: URL-encoded
            `/my/connect?email=${encodeURIComponent(emailLower)}&appkey=DEMOAPIAPP&rid=${rid}`,
            // Formato 2: Sin URL-encoding
            `/my/connect?email=${emailLower}&appkey=DEMOAPIAPP&rid=${rid}`,
            // Formato 3: Email original
            `/my/connect?email=${encodeURIComponent(emailOriginal)}&appkey=DEMOAPIAPP&rid=${rid}`,
            // Formato 4: Sin appkey
            `/my/connect?email=${encodeURIComponent(emailLower)}&rid=${rid}`,
        ];

        const results: any[] = [];

        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            const sig1 = await hmacSha256(query, secret1);
            const sig2 = await hmacSha256(query, secret2);

            log(`\n[QUERY-${i + 1}] ${query}`);
            log(`  - HMAC(secret1): ${sig1.substring(0, 20)}...`);
            log(`  - HMAC(secret2): ${sig2.substring(0, 20)}...`);

            // Prueba la primera combinación
            const testUrl = `https://api.jdownloader.org${query}&signature=${sig1}`;
            log(`  - Testing: ${testUrl.substring(0, 80)}...`);

            try {
                const response = await fetch(testUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                log(`  - Response: ${response.status} ${response.statusText}`);

                if (response.ok) {
                    const data = await response.json();
                    log(`  ✅ SUCCESS! Response: ${JSON.stringify(data).substring(0, 100)}...`);
                    results.push({
                        index: i,
                        query: query,
                        status: response.status,
                        success: true,
                        data,
                    });
                } else {
                    const text = await response.text();
                    log(`  ❌ FAILED: ${text.substring(0, 100)}`);
                    results.push({
                        index: i,
                        query: query,
                        status: response.status,
                        success: false,
                        error: text,
                    });
                }
            } catch (err: any) {
                log(`  ⚠️ Network error: ${err.message}`);
                results.push({
                    index: i,
                    query: query,
                    success: false,
                    error: err.message,
                });
            }

            // Pequeño delay para no saturar API
            await new Promise(r => setTimeout(r, 500));
        }

        const successResult = results.find(r => r.success);

        return NextResponse.json({
            success: !!successResult,
            successfulIndex: successResult?.index,
            successfulQuery: successResult?.query,
            results,
            logs,
            recommendation: successResult
                ? `✅ Usa el formato de query #${successResult.index + 1}`
                : '❌ Ninguna combinación funcionó. El problema podría ser diferente.',
        });

    } catch (error: any) {
        console.error('[Debug HMAC] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack,
        }, { status: 500 });
    }
}
