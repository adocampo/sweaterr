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
        { success: false, errorKey: 'forumForm.missingNameOrUrl' },
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

    // Prioritize form values over the saved configuration during testing.
    const authRequired = body.requiresAuthentication !== undefined
      ? body.requiresAuthentication
      : (existing?.requiresAuthentication ?? true);
    const useFs = body.useFlaresolverr !== undefined
      ? body.useFlaresolverr
      : (existing?.useFlaresolverr ?? true);
    const testConfig = {
      id: existing?.id || 'test',
      name: existing?.name || name,
      baseUrl: existing?.baseUrl || baseUrl,
      searchPath: existing?.searchPath || searchPath || '/search.php',
      searchMode: existing?.searchMode || searchMode,
      persistentCookies: existing?.persistentCookies || undefined,
      requiresAuthentication: authRequired,
      useFlaresolverr: useFs,
      credentials: authRequired && username && password
        ? { username, password }
        : (authRequired && existing?.credentials)
          ? { username: existing.credentials.username, password: existing.credentials.password }
          : undefined,
    } as any;

    try {
      forumService.addForum(testConfig);
      logger.info('forum', `Forum check: added config for ${testConfig.name} (${testConfig.baseUrl})`);
    } catch (err: any) {
      logger.error('forum', `Forum check: failed to add forum config: ${err?.message || String(err)}`);
      return NextResponse.json({ success: false, errorKey: 'forumForm.testPreparationError' }, { status: 500 });
    }

    // Test authentication if credentials provided and requiresAuthentication is true
    if (authRequired && testConfig.credentials) {
      logger.info('forum', `=== TESTING FORUM: ${name} ===`);
      logger.info('forum', `URL: ${baseUrl}`);
      logger.info('forum', `User: ${username}`);
      logger.info('forum', `Mode: Playwright + Cloudflare bypass`);

      const authenticated = await forumService.authenticate(testConfig.id);

      if (!authenticated) {
        logger.warn('forum', '[ForumCheck] Authentication failed');
        return NextResponse.json({
          success: false,
          errorKey: 'forumForm.authenticationFailed',
          sessionStarted: false,
        });
      }

      console.log('[ForumCheck] ✓ Authentication succeeded');

      // After successful authentication, attempt to create a FlareSolverr session for future requests
      let sessionStarted = false;
      let sessionMessage = '';

      try {
        const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;
        const shouldUseFlareSolverr = useFs;
        logger.info('forum', `[ForumCheck] FlareSolverr URL: ${flaresolverrUrl || 'MISSING'}`);
        logger.info('forum', `[ForumCheck] Existing forum ID: ${existing?.id || 'none'}`);
        logger.info('forum', `[ForumCheck] useFlaresolverr: ${existing?.useFlaresolverr ?? 'not set'}, shouldUse: ${shouldUseFlareSolverr}`);

        if (shouldUseFlareSolverr && flaresolverrUrl && existing?.id) {
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
          if (!shouldUseFlareSolverr) {
            logger.info('forum', '[ForumCheck] Skipping session creation: useFlaresolverr is disabled for this forum');
            sessionMessage = 'Autenticación exitosa. FlareSolverr está desactivado para este foro.';
          } else if (!flaresolverrUrl) {
            logger.info('forum', '[ForumCheck] Skipping session creation: FlareSolverr URL not configured');
            sessionMessage = 'Autenticación exitosa (no se creó sesión FlareSolverr porque no hay URL configurada).';
          } else {
            logger.info('forum', '[ForumCheck] Skipping session creation: FlareSolverr URL or existing forum ID missing');
            sessionMessage = 'Autenticación exitosa (no se creó sesión FlareSolverr porque el foro no está guardado aún).';
          }
        }
      } catch (err) {
        logger.error('forum', `[ForumCheck] Error attempting to create FlareSolverr session: ${err}`);
        sessionMessage = 'Autenticación exitosa, pero hubo un error al crear la sesión.';
      }

      logger.info('forum', `[ForumCheck] Returning response: sessionStarted=${sessionStarted}`);

      return NextResponse.json({
        success: true,
        messageKey: 'forumForm.authenticationSucceeded',
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
          messageKey: 'forumForm.connectionAccessible',
        });
      }

      logger.warn('forum', `[ForumCheck] Base URL responded with error status ${response.status}`);
      return NextResponse.json({
        success: false,
        errorKey: 'forumForm.forumResponseError',
        messageParams: { status: response.status },
      });
    } catch (error: any) {
      logger.error('forum', `[ForumCheck] Connection error: ${error?.message || String(error)}`);
      return NextResponse.json({
        success: false,
        errorKey: 'forumForm.forumConnectionError',
        messageParams: { reason: error.message },
      });
    }
  } catch (error) {
    logger.error('forum', `Error testing forum: ${error}`);
    return NextResponse.json(
      { success: false, errorKey: 'forumForm.connectionTestError' },
      { status: 500 }
    );
  } finally {
    // Clean up Playwright resources
    if (forumService) {
      await forumService.cleanup();
    }
  }
}
