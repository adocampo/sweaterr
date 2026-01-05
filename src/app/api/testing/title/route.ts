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

export async function POST(request: NextRequest) {
    try {
        const { forumId, postUrl } = await request.json();

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

        // Axios client will be created after we resolve the host-level CookieJar

        if (!forumId || !postUrl) {
            return NextResponse.json(
                { success: false, error: 'forumId y postUrl son requeridos' },
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

        let html = '';

        // Parse persisted cookies structure: could be array or { cookies, userAgent }
        const parsedCookies = forum.persistentCookies ? JSON.parse(forum.persistentCookies) : [];
        const cookieArr: Array<{ name: string; value: string }> = Array.isArray(parsedCookies)
            ? parsedCookies
            : parsedCookies && typeof parsedCookies === 'object'
                ? Array.isArray((parsedCookies as any).cookies) ? (parsedCookies as any).cookies : []
                : [];
        const storedUserAgent: string | undefined = parsedCookies && typeof parsedCookies === 'object' && typeof (parsedCookies as any).userAgent === 'string'
            ? (parsedCookies as any).userAgent
            : undefined;

        const host = new URL(postUrl).hostname;
        const jar: CookieJar = getJarForHost(host);

        // Preload jar from persisted DB cookies once per process lifecycle
        if (cookieArr.length > 0) {
            await preloadJarCookies(jar, postUrl, cookieArr);
            logger.info('testing', `Using CookieJar for ${host} with ${cookieArr.length} persisted cookies`);
        }

        // Create axios client bound to the host-level jar
        const client = axiosCookieJarSupport(axios.create({
            jar,
            withCredentials: true,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Upgrade-Insecure-Requests': '1',
                // Avoid Sec-Fetch headers that can flag automation; keep it closer to server-side navigation
                'User-Agent': storedUserAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // Referer to same origin helps avoid cross-site signals
                'Referer': forum.baseUrl || `https://${host}/`,
            },
            timeout: 20000,
        }));

        // Always try axios first (even for thread URLs). If Cloudflare challenges, fallback to FlareSolverr, persist cookies, and retry once.
        const tryAxios = async () => {
            const res = await client.get(postUrl);
            const body = String(res.data || '');
            // Quick heuristics to detect challenge pages
            const looksLikeChallenge = res.status === 403 || body.includes('cf-mitigated') || body.includes('Just a moment');
            if (looksLikeChallenge) throw Object.assign(new Error('Cloudflare challenge'), { response: { status: res.status } });
            return body;
        };

        try {
            // If bypassAxios is enabled, skip axios and go straight to FlareSolverr
            if (bypassAxios) {
                logger.info('testing', `[BYPASS MODE] Skipping Axios, using FlareSolverr directly`);
                throw new Error('Bypass mode enabled');
            }

            html = await tryAxios();
            if (cookieArr.length > 0) {
                logger.info('testing', `✓ Axios succeeded WITH PERSISTED COOKIES - No FlareSolverr needed!`);
            } else {
                logger.info('testing', `✓ Axios succeeded for ${host}`);
            }
        } catch (firstErr: any) {
            const status = firstErr?.response?.status;
            logger.info('testing', `✗ Axios failed (status ${status}). Trying FlareSolverr...`);
            const flaresolverrUrl = process.env.FLARESOLVERR_URL;
            if (!flaresolverrUrl) {
                return NextResponse.json(
                    { success: false, error: 'FlareSolverr no configurado' },
                    { status: 500 }
                );
            }
            const fsClient = new FlareSolverrClient(flaresolverrUrl);

            // Get or create persistent session (managed globally per forum)
            const ttlMs = forum.flaresolverrSessionTTL || 30 * 60 * 1000;
            const sessionId = await sessionManager.getSession(forum.id, host, ttlMs, fsClient);
            const solution = await fsClient.request(postUrl, 'GET', undefined, sessionId);
            const solvedCookies = solution.cookies || [];

            // Merge solved cookies into jar and persist to DB
            if (solvedCookies.length > 0) {
                await preloadJarCookies(jar, postUrl, solvedCookies);
                const mergedByName = new Map<string, string>();
                for (const c of cookieArr) mergedByName.set(c.name, c.value);
                for (const c of solvedCookies) mergedByName.set(c.name, c.value);
                const merged = Array.from(mergedByName.entries()).map(([name, value]) => ({ name, value }));
                const toPersist: any = { cookies: merged, userAgent: solution.userAgent || storedUserAgent };
                await db.forum.update({
                    where: { id: forum.id },
                    data: { persistentCookies: JSON.stringify(toPersist), cookiesUpdatedAt: new Date() },
                });
                logger.info('testing', `Persisted ${merged.length} cookies after FlareSolverr`);
            }

            // Prefer axios parsing for consistent headers; fallback to solution HTML if retry also fails
            try {
                html = await tryAxios();
                logger.info('testing', `✓ Axios succeeded after FlareSolverr`);
            } catch {
                html = solution.response || '';
                logger.info('testing', `Using FlareSolverr HTML response`);
            }
        }

        // Check if we're getting a LaLiga block page
        if (html.includes('Liga Nacional de Fútbol') || html.includes('laliga.com')) {
            logger.warn('testing', `⚠️ LaLiga block page detected - Forum access blocked`);
            return NextResponse.json({
                success: false,
                error: 'Forum blocked by LaLiga. Configure FlareSolverr with VPN/proxy.'
            });
        }

        const $ = cheerio.load(html);

        // Prefer configured selector; fallback to vBulletin-specific selectors
        const sel = forum.postTitleSelector || '.threadtitle, #thread_title, .navbar strong, h1, h2';
        const title = $(sel).first().text().trim();

        logger.info('testing', `✓ Title extracted: ${title || '(no title found)'}`);
        return NextResponse.json({ success: true, title: title || null });
    } catch (error) {
        logger.error('testing', `Error: ${error instanceof Error ? error.message : String(error)}`);
        return NextResponse.json(
            { success: false, error: 'Error al obtener el título' },
            { status: 500 }
        );
    }
}
