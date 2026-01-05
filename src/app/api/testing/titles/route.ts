import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import { sessionManager } from '@/lib/services/flaresolverr-session-manager';
import { logger } from '@/lib/logger';
import { verifyTokenEdge } from '@/lib/edge-jwt';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import { getJarForHost, preloadJarCookies } from '@/lib/cookie-jar-store';

// POST /api/testing/titles - Resolve multiple titles at once
export async function POST(request: NextRequest) {
    try {
        const { forumId, postUrls } = await request.json();

        if (!forumId || !Array.isArray(postUrls) || postUrls.length === 0) {
            return NextResponse.json(
                { success: false, error: 'forumId y array postUrls son requeridos' },
                { status: 400 }
            );
        }

        const forum = await db.forum.findUnique({ where: { id: forumId } });
        if (!forum) {
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        // Get user settings to check bypassAxios
        const token = request.cookies.get('sweaterr-auth')?.value;
        let bypassAxios = false;
        if (token) {
            try {
                const payload = await verifyTokenEdge(token);
                if (payload && typeof payload.id === 'string') {
                    const userId = payload.id;
                    const settings = await db.testingSettings.findUnique({
                        where: { userId },
                    });
                    bypassAxios = settings?.bypassAxios ?? false;
                }
            } catch (err) {
                // Silently ignore settings fetch error
            }
        }

        const results: Array<{ url: string; title: string | null; error?: string }> = [];

        // Try to resolve all with a single FlareSolverr request by visiting each URL
        const flaresolverrUrl = process.env.FLARESOLVERR_URL;

        if (!flaresolverrUrl) {
            return NextResponse.json(
                { success: false, error: 'FlareSolverr no configurado' },
                { status: 500 }
            );
        }

        logger.info('testing', `[BULK] Resolving ${postUrls.length} titles for forum: ${forum.name}`);
        logger.info('testing', `[BULK] bypassAxios mode: ${bypassAxios ? 'ENABLED' : 'DISABLED'}`);

        // Parse persisted cookies
        const parsedCookies = forum.persistentCookies ? JSON.parse(forum.persistentCookies) : [];
        const cookieArr: Array<{ name: string; value: string }> = Array.isArray(parsedCookies)
            ? parsedCookies
            : parsedCookies && typeof parsedCookies === 'object'
                ? Array.isArray((parsedCookies as any).cookies)
                    ? (parsedCookies as any).cookies
                    : []
                : [];
        const storedUserAgent: string | undefined =
            parsedCookies && typeof parsedCookies === 'object' && typeof (parsedCookies as any).userAgent === 'string'
                ? (parsedCookies as any).userAgent
                : undefined;

        const host = new URL(postUrls[0]).hostname;
        const jar: CookieJar = getJarForHost(host);

        // Preload jar from persisted DB cookies
        if (cookieArr.length > 0) {
            await preloadJarCookies(jar, postUrls[0], cookieArr);
            logger.info('testing', `[BULK] Using CookieJar for ${host} with ${cookieArr.length} persisted cookies`);
        }

        // Create axios client
        const client = axiosCookieJarSupport(
            axios.create({
                jar,
                withCredentials: true,
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9',
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent':
                        storedUserAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Referer: forum.baseUrl || `https://${host}/`,
                },
                timeout: 20000,
            })
        );

        const fsClient = new FlareSolverrClient(flaresolverrUrl);
        let usedFlareSolverr = false;

        // If bypassAxios, go straight to FlareSolverr for all URLs
        if (bypassAxios) {
            logger.info('testing', `[BULK] [BYPASS MODE] Using FlareSolverr for all ${postUrls.length} URLs`);
            usedFlareSolverr = true;

            // Get or create persistent session (managed globally per forum)
            const ttlMs = forum.flaresolverrSessionTTL || 30 * 60 * 1000;
            const sessionId = await sessionManager.getSession(forumId, host, ttlMs, fsClient);

            for (let i = 0; i < postUrls.length; i++) {
                const postUrl = postUrls[i];
                try {
                    logger.info('testing', `[BULK] [${i + 1}/${postUrls.length}] Fetching with FlareSolverr (session): ${postUrl.substring(0, 80)}...`);
                    const solution = await fsClient.request(postUrl, 'GET', undefined, sessionId);
                    const html = solution.response || '';

                    // Extract title
                    const $ = cheerio.load(html);
                    const sel = forum.postTitleSelector || '.threadtitle, #thread_title, .navbar strong, h1, h2';
                    const title = $(sel).first().text().trim();

                    results.push({
                        url: postUrl,
                        title: title || null,
                    });
                    logger.info('testing', `[BULK] [${i + 1}/${postUrls.length}] ✓ Title: ${title || '(no title found)'}`);
                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    logger.warn('testing', `[BULK] [${i + 1}/${postUrls.length}] ✗ Error: ${errMsg}`);
                    results.push({
                        url: postUrl,
                        title: null,
                        error: errMsg,
                    });
                }
            }

            // Persist cookies from FlareSolverr for future use
            if (usedFlareSolverr) {
                try {
                    const finalCookies = await jar.getCookies(postUrls[0]);
                    const merged = finalCookies.map((c) => ({ name: c.key, value: c.value }));
                    const toPersist: any = { cookies: merged, userAgent: storedUserAgent };
                    await db.forum.update({
                        where: { id: forum.id },
                        data: {
                            persistentCookies: JSON.stringify(toPersist),
                            cookiesUpdatedAt: new Date(),
                        },
                    });
                    logger.info('testing', `[BULK] Persisted ${merged.length} cookies after FlareSolverr`);
                } catch (err) {
                    logger.warn('testing', `[BULK] Failed to persist cookies: ${err}`);
                }
            }
        } else {
            // Try Axios first, fallback to FlareSolverr if needed
            let sessionId: string | undefined;

            for (let i = 0; i < postUrls.length; i++) {
                const postUrl = postUrls[i];
                let html = '';

                try {
                    logger.info('testing', `[BULK] [${i + 1}/${postUrls.length}] Trying Axios: ${postUrl.substring(0, 80)}...`);
                    const res = await client.get(postUrl);
                    html = String(res.data || '');
                    const looksLikeChallenge = res.status === 403 || html.includes('cf-mitigated') || html.includes('Just a moment');
                    if (looksLikeChallenge) throw new Error('Cloudflare challenge detected');

                    logger.info('testing', `[BULK] [${i + 1}/${postUrls.length}] ✓ Axios succeeded`);
                } catch (axiosErr) {
                    // Fallback to FlareSolverr
                    logger.info('testing', `[BULK] [${i + 1}/${postUrls.length}] ✗ Axios failed, trying FlareSolverr...`);

                    // Get or create session on first FlareSolverr use (managed globally per forum)
                    if (!usedFlareSolverr) {
                        usedFlareSolverr = true;
                        const ttlMs = forum.flaresolverrSessionTTL || 30 * 60 * 1000;
                        sessionId = await sessionManager.getSession(forumId, host, ttlMs, fsClient);
                    }

                    try {
                        const solution = await fsClient.request(postUrl, 'GET', undefined, sessionId);
                        html = solution.response || '';

                        // Merge FlareSolverr cookies into jar for future requests
                        if (solution.cookies && solution.cookies.length > 0) {
                            await preloadJarCookies(jar, postUrl, solution.cookies);

                            // Update axios client to use the new User-Agent from FlareSolverr
                            if (solution.userAgent) {
                                client.defaults.headers['User-Agent'] = solution.userAgent;
                            }
                        }

                        logger.info('testing', `[BULK] [${i + 1}/${postUrls.length}] ✓ FlareSolverr resolved`);
                    } catch (fsErr) {
                        const errMsg = fsErr instanceof Error ? fsErr.message : String(fsErr);
                        logger.warn('testing', `[BULK] [${i + 1}/${postUrls.length}] ✗ FlareSolverr failed: ${errMsg}`);
                        results.push({
                            url: postUrl,
                            title: null,
                            error: errMsg,
                        });
                        continue;
                    }
                }

                // Extract title from html
                try {
                    const $ = cheerio.load(html);
                    const sel = forum.postTitleSelector || '.threadtitle, #thread_title, .navbar strong, h1, h2';
                    const title = $(sel).first().text().trim();

                    results.push({
                        url: postUrl,
                        title: title || null,
                    });
                    logger.info('testing', `[BULK] [${i + 1}/${postUrls.length}] ✓ Title: ${title || '(no title found)'}`);
                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    logger.warn('testing', `[BULK] [${i + 1}/${postUrls.length}] ✗ Parse error: ${errMsg}`);
                    results.push({
                        url: postUrl,
                        title: null,
                        error: `Parse error: ${errMsg}`,
                    });
                }
            }

            // Persist cookies if we used FlareSolverr
            if (usedFlareSolverr) {
                try {
                    const finalCookies = await jar.getCookies(postUrls[0]);
                    const merged = finalCookies.map((c) => ({ name: c.key, value: c.value }));
                    const toPersist: any = { cookies: merged, userAgent: storedUserAgent };
                    await db.forum.update({
                        where: { id: forum.id },
                        data: {
                            persistentCookies: JSON.stringify(toPersist),
                            cookiesUpdatedAt: new Date(),
                        },
                    });
                    logger.info('testing', `[BULK] Persisted ${merged.length} cookies after FlareSolverr`);
                } catch (err) {
                    logger.warn('testing', `[BULK] Failed to persist cookies: ${err}`);
                }
            }
        }

        logger.info('testing', `[BULK] Completed: ${results.length} titles resolved`);

        return NextResponse.json({
            success: true,
            data: {
                forumId,
                results,
                totalResolved: results.filter((r) => r.title).length,
                totalErrors: results.filter((r) => r.error).length,
            },
        });
    } catch (error) {
        logger.error('testing', `[BULK] Error: ${error instanceof Error ? error.message : String(error)}`);
        return NextResponse.json(
            { success: false, error: 'Error al resolver títulos' },
            { status: 500 }
        );
    }
}
