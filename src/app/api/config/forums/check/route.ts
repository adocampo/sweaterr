import { NextRequest, NextResponse } from 'next/server';
import { ForumService } from '@/lib/services/forum';
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
            console.log(`\n=== Testing forum: ${name} ===`);
            console.log(`URL: ${baseUrl}`);
            console.log(`User: ${username}`);
            console.log(`Mode: Playwright + Cloudflare bypass`);

            const authenticated = await forumService.authenticate(testConfig.id);

            if (!authenticated) {
                return NextResponse.json({
                    success: false,
                    error: 'Autenticación fallida. Verifica tus credenciales. Revisa los logs de la consola para más detalles.',
                });
            }

            return NextResponse.json({
                success: true,
                message: 'Autenticación exitosa. El foro está configurado correctamente.',
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
