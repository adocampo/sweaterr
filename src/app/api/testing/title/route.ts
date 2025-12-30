import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import { getJarForHost, preloadJarCookies } from '@/lib/cookie-jar-store';

export async function POST(request: NextRequest) {
    try {
        const { forumId, postUrl } = await request.json();

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
            console.log(`[Testing/Title] Using CookieJar for ${host} with ${cookieArr.length} persisted cookies`);
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
            html = await tryAxios();
            console.log(`[Testing/Title] ✓ Axios succeeded for ${host}`);
        } catch (firstErr: any) {
            const status = firstErr?.response?.status;
            console.log(`[Testing/Title] ✗ Axios failed (status ${status}). Trying FlareSolverr...`);
            const flaresolverrUrl = process.env.FLARESOLVERR_URL;
            if (!flaresolverrUrl) {
                return NextResponse.json(
                    { success: false, error: 'FlareSolverr no configurado' },
                    { status: 500 }
                );
            }
            const fsClient = new FlareSolverrClient(flaresolverrUrl);
            const solution = await fsClient.request(postUrl, 'GET');
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
                console.log(`[Testing/Title] Persisted ${merged.length} cookies after FlareSolverr`);
            }

            // Prefer axios parsing for consistent headers; fallback to solution HTML if retry also fails
            try {
                html = await tryAxios();
                console.log('[Testing/Title] ✓ Axios succeeded after FlareSolverr');
            } catch {
                html = solution.response || '';
                console.log('[Testing/Title] Using FlareSolverr HTML response');
            }
        }

        // Check if we're getting a LaLiga block page
        if (html.includes('Liga Nacional de Fútbol') || html.includes('laliga.com')) {
            console.log('[Testing/Title] ⚠️ LaLiga block page detected - Forum access blocked');
            return NextResponse.json({
                success: false,
                error: 'Forum blocked by LaLiga. Configure FlareSolverr with VPN/proxy.'
            });
        }

        const $ = cheerio.load(html);

        // Prefer configured selector; fallback to vBulletin-specific selectors
        const sel = forum.postTitleSelector || '.threadtitle, #thread_title, .navbar strong, h1, h2';
        const title = $(sel).first().text().trim();

        return NextResponse.json({ success: true, title: title || null });
    } catch (error) {
        console.error('[Testing/Title] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener el título' },
            { status: 500 }
        );
    }
}
