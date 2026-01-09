import { NextRequest, NextResponse } from 'next/server';
import { ForumService } from '@/lib/services/forum';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import { sessionManager } from '@/lib/services/flaresolverr-session-manager';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
    let forumService: ForumService | null = null;

    try {
        const body = await request.json();
        const { name, baseUrl, searchPath, searchMode, username, password } = body;

        if (!name || !baseUrl) {
            return NextResponse.json(
                { success: false, error: 'Nombre y URL base son requeridos' },
                { status: 400 }
            );
        }

        forumService = new ForumService();

        // Try to find existing forum to reuse persistent cookies
        const existing = await db.forum.findFirst({
            where: {
                OR: [
                    { baseUrl },
                    { name },
                ],
            },
            include: { credentials: true },
        });

        // Add forum config for testing (bind to existing id if present)
        const testConfig = {
            id: existing?.id || 'test',
            name: existing?.name || name,
            baseUrl: existing?.baseUrl || baseUrl,
            searchPath: existing?.searchPath || searchPath || '/search.php',
            searchMode: existing?.searchMode || searchMode,
            persistentCookies: existing?.persistentCookies || undefined,
            credentials: username && password
                ? { username, password }
                : existing?.credentials
                    ? { username: existing.credentials.username, password: existing.credentials.password }
                    : undefined,
        } as any;

        forumService.addForum(testConfig);

        // Test authentication if credentials provided
        if (username && password) {
            console.log(`\n=== TESTING FORUM: ${name} ===`);
            console.log(`URL: ${baseUrl}`);
            console.log(`User: ${username}`);
            console.log(`Mode: Playwright + Cloudflare bypass`);

            const authenticated = await forumService.authenticate(testConfig.id);

            if (!authenticated) {
                console.log('[ForumCheck] ❌ Authentication failed');
                return NextResponse.json({
                    success: false,
                    error: 'Autenticación fallida. Verifica tus credenciales. Revisa los logs de la consola para más detalles.',
                    sessionStarted: false,
                });
            }

            console.log('[ForumCheck] ✓ Authentication succeeded');

            // After successful authentication, attempt to create a FlareSolverr session for future requests
            let sessionStarted = false;
            let sessionMessage = '';
            
            try {
                const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;
                console.log('[ForumCheck] FlareSolverr URL:', flaresolverrUrl);
                console.log('[ForumCheck] Existing forum ID:', existing?.id);
                
                if (flaresolverrUrl && existing?.id) {
                    console.log('[ForumCheck] Attempting to create FlareSolverr session...');
                    const fsClient = new FlareSolverrClient(flaresolverrUrl);
                    const url = new URL(baseUrl);
                    const ttlMs = existing.flaresolverrSessionTTL || (30 * 60 * 1000); // Default 30 minutes
                    
                    try {
                        const sessionId = await sessionManager.getSession(
                            existing.id,
                            url.host,
                            ttlMs,
                            fsClient
                        );
                        sessionStarted = true;
                        sessionMessage = `Sesión FlareSolverr iniciada (ID: ${sessionId.substring(0, 8)}..., TTL: ${Math.round(ttlMs / 60000)}m).`;
                        console.log(`[ForumCheck] ✓ SUCCESS: ${sessionMessage}`);
                    } catch (sessionErr) {
                        console.warn('[ForumCheck] ⚠️ Could not create FlareSolverr session, but authentication succeeded:', sessionErr);
                        sessionMessage = 'Autenticación exitosa, pero no se pudo crear sesión FlareSolverr (las búsquedas funcionarán pero requerirán más tiempo).';
                    }
                } else {
                    console.log('[ForumCheck] Skipping session creation: FlareSolverr URL or existing forum ID missing');
                    sessionMessage = 'Autenticación exitosa (no se creó sesión FlareSolverr porque el foro no está guardado aún).';
                }
            } catch (err) {
                console.error('[ForumCheck] ❌ Error attempting to create FlareSolverr session:', err);
                sessionMessage = 'Autenticación exitosa, pero hubo un error al crear la sesión.';
            }

            console.log('[ForumCheck] Returning response: sessionStarted =', sessionStarted);

            return NextResponse.json({
                success: true,
                message: sessionStarted 
                    ? `Autenticación exitosa. ${sessionMessage}`
                    : 'Autenticación exitosa. El foro está configurado correctamente.',
                sessionStarted,
            });
        }

        // If no credentials, just validate URL accessibility
        try {
            const response = await fetch(baseUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: AbortSignal.timeout(10000),
            });

            if (response.ok || response.status === 403 || response.status === 401) {
                // 403/401 means the site exists but may require login
                return NextResponse.json({
                    success: true,
                    message: 'URL accesible. Considera añadir credenciales si el foro las requiere.',
                });
            }

            return NextResponse.json({
                success: false,
                error: `El foro respondió con código ${response.status}`,
            });
        } catch (error: any) {
            return NextResponse.json({
                success: false,
                error: `No se pudo conectar al foro: ${error.message}`,
            });
        }
    } catch (error) {
        console.error('Error testing forum:', error);
        return NextResponse.json(
            { success: false, error: 'Error al probar la conexión del foro' },
            { status: 500 }
        );
    } finally {
        // Clean up Playwright resources
        if (forumService) {
            await forumService.cleanup();
        }
    }
}
