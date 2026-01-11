import { NextRequest, NextResponse } from 'next/server';
import { ForumService } from '@/lib/services/forum';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import { sessionManager } from '@/lib/services/flaresolverr-session-manager';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let forumService: ForumService | null = null;

  try {
    const body = await request.json();
    const { name, baseUrl, searchPath, searchMode, username, password } = body;

    if (!name || !baseUrl) {
      logger.warn('forum', 'Forum check: missing name or baseUrl');
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

    try {
      forumService.addForum(testConfig);
      logger.info('forum', `Forum check: added config for ${testConfig.name} (${testConfig.baseUrl})`);
    } catch (err: any) {
      logger.error('forum', `Forum check: failed to add forum config: ${err?.message || String(err)}`);
      return NextResponse.json({ success: false, error: 'No se pudo preparar la configuración del foro para la prueba.' }, { status: 500 });
    }

    // Test authentication if credentials provided
    if (username && password) {
      logger.info('forum', `=== TESTING FORUM: ${name} ===`);
      logger.info('forum', `URL: ${baseUrl}`);
      logger.info('forum', `User: ${username}`);
      logger.info('forum', `Mode: Playwright + Cloudflare bypass`);

      const authenticated = await forumService.authenticate(testConfig.id);

      if (!authenticated) {
        logger.warn('forum', '[ForumCheck] Authentication failed');
        return NextResponse.json({
          success: false,
          error: 'Autenticación fallida. Verifica tus credenciales. Revisa los logs (logs/forum.log) para más detalles.',
          sessionStarted: false,
        });
      }

      console.log('[ForumCheck] ✓ Authentication succeeded');

      // After successful authentication, attempt to create a FlareSolverr session for future requests
      let sessionStarted = false;
      let sessionMessage = '';

      try {
        const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;
        logger.info('forum', `[ForumCheck] FlareSolverr URL: ${flaresolverrUrl || 'MISSING'}`);
        logger.info('forum', `[ForumCheck] Existing forum ID: ${existing?.id || 'none'}`);

        if (flaresolverrUrl && existing?.id) {
          logger.info('forum', '[ForumCheck] Attempting to create FlareSolverr session...');
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
            logger.info('forum', `[ForumCheck] ✓ SUCCESS: ${sessionMessage}`);
          } catch (sessionErr) {
            logger.warn('forum', `[ForumCheck] ⚠️ Could not create FlareSolverr session, but authentication succeeded: ${sessionErr}`);
            sessionMessage = 'Autenticación exitosa, pero no se pudo crear sesión FlareSolverr (las búsquedas funcionarán pero requerirán más tiempo).';
          }
        } else {
          logger.info('forum', '[ForumCheck] Skipping session creation: FlareSolverr URL or existing forum ID missing');
          sessionMessage = 'Autenticación exitosa (no se creó sesión FlareSolverr porque el foro no está guardado aún).';
        }
      } catch (err) {
        logger.error('forum', `[ForumCheck] Error attempting to create FlareSolverr session: ${err}`);
        sessionMessage = 'Autenticación exitosa, pero hubo un error al crear la sesión.';
      }

      logger.info('forum', `[ForumCheck] Returning response: sessionStarted=${sessionStarted}`);

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
        logger.info('forum', `[ForumCheck] Base URL responded with status ${response.status}`);
        return NextResponse.json({
          success: true,
          message: 'URL accesible. Considera añadir credenciales si el foro las requiere.',
        });
      }

      logger.warn('forum', `[ForumCheck] Base URL responded with error status ${response.status}`);
      return NextResponse.json({
        success: false,
        error: `El foro respondió con código ${response.status}`,
      });
    } catch (error: any) {
      logger.error('forum', `[ForumCheck] Connection error: ${error?.message || String(error)}`);
      return NextResponse.json({
        success: false,
        error: `No se pudo conectar al foro: ${error.message}`,
      });
    }
  } catch (error) {
    logger.error('forum', `Error testing forum: ${error}`);
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
