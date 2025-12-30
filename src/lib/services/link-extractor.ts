import { FlareSolverrClient } from './flaresolverr-client';
import axios from 'axios';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { db } from '@/lib/db';
import { getJarForHost, preloadJarCookies } from '@/lib/cookie-jar-store';

interface ExtractLinksResult {
    success: boolean;
    links?: string[];
    error?: string;
}

interface LoginResult {
    success: boolean;
    cookies?: Array<{ name: string; value: string }>;
    error?: string;
}

/**
 * Login to forum using FlareSolverr
 */
async function loginToForum(
    baseUrl: string,
    username: string,
    password: string,
    flaresolverrUrl: string
): Promise<LoginResult> {
    try {
        const client = new FlareSolverrClient(flaresolverrUrl);

        // Warm up base URL to obtain CF cookies
        console.log('[LinkExtractor] Warming up forum base URL:', baseUrl);
        const warm = await client.request(baseUrl, 'GET');

        // Perform vBulletin login POST
        console.log('[LinkExtractor] Attempting login for user:', username);
        const postData = {
            do: 'login',
            vb_login_username: username,
            vb_login_password: password,
            s: '',
            securitytoken: 'guest',
            url: `${baseUrl}/forum.php`,
            cookieuser: '1',
        };

        const login = await client.request(`${baseUrl}/login.php?do=login`, 'POST', postData);
        const loginHtml = login.response || '';

        // Check for vBulletin login error messages
        if (
            loginHtml.includes('nombre de usuario o contraseña no válidos') ||
            loginHtml.includes('incorrect') ||
            loginHtml.includes('invalid username or password') ||
            loginHtml.includes('has introducido un nombre de usuario o contraseña')
        ) {
            console.log('[LinkExtractor] Login failed: invalid credentials');
            return { success: false, error: 'Invalid credentials' };
        }

        // Verify session cookies
        const hasSessionCookie = login.cookies.some(
            (c) => c.name.startsWith('bb') || c.name.includes('session') || c.name.includes('userid')
        );

        if (!hasSessionCookie) {
            console.log('[LinkExtractor] Login failed: no session cookies');
            return { success: false, error: 'No session cookies received' };
        }

        console.log('[LinkExtractor] Login successful');
        return { success: true, cookies: login.cookies };
    } catch (error) {
        console.error('[LinkExtractor] Login error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Login failed',
        };
    }
}
/**
 * Extract direct download links from a forum post by clicking "Gracias" button
 * 
 * Flow:
 * 1. Login to forum (if credentials provided)
 * 2. Navigate to post URL
 * 3. Click "Gracias" button (a.post_thanks_button)
 * 4. Wait for unhidden content (#vfc_unhide_thanks_post_{postId})
 * 5. Extract URLs from <pre class="bbcode_code">
 * 
 * @param postUrl - Full URL of the forum post
 * @param forumBaseUrl - Base URL of the forum
 * @param username - Optional forum username
 * @param password - Optional forum password
 * @param flaresolverrUrl - Optional FlareSolverr URL (defaults to env var)
 */
export async function extractLinksFromPost(
    postUrl: string,
    forumBaseUrl: string,
    username?: string,
    password?: string,
    flaresolverrUrl?: string,
    forumId?: string
): Promise<ExtractLinksResult> {
    try {
        const flareUrl = flaresolverrUrl || process.env.FLARESOLVERR_URL;

        if (!flareUrl) {
            return { success: false, error: 'FlareSolverr URL not configured' };
        }

        const host = new URL(postUrl).hostname;
        const jar: CookieJar = getJarForHost(host);

        // Load persisted cookies + UA
        let storedUserAgent: string | undefined;
        let persistedCookies: Array<{ name: string; value: string; domain?: string; path?: string }> = [];
        if (forumId) {
            const forum = await db.forum.findUnique({ where: { id: forumId } });
            if (forum?.persistentCookies) {
                const parsed = JSON.parse(forum.persistentCookies);
                if (Array.isArray(parsed)) {
                    persistedCookies = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    persistedCookies = Array.isArray(parsed.cookies) ? parsed.cookies : [];
                    storedUserAgent = typeof parsed.userAgent === 'string' ? parsed.userAgent : undefined;
                }
            }
        }
        if (persistedCookies.length > 0) {
            await preloadJarCookies(jar, postUrl, persistedCookies);
        }

        const axiosClient = axiosCookieJarSupport(axios.create({
            jar,
            withCredentials: true,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': storedUserAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': forumBaseUrl || `https://${host}/`,
            },
            timeout: 20000,
        }));

        const fsClient = flareUrl ? new FlareSolverrClient(flareUrl) : null;

        const useFlareSolverr = async (url: string, method: 'GET' | 'POST' = 'GET', postData?: Record<string, any>) => {
            if (!fsClient) throw new Error('FlareSolverr URL not configured');
            const sol = await fsClient.request(url, method, postData);
            const solvedCookies = sol.cookies || [];
            if (solvedCookies.length > 0) {
                await preloadJarCookies(jar, url, solvedCookies);
                // Persist merge
                if (forumId) {
                    const mergedByName = new Map<string, string>();
                    for (const c of persistedCookies) mergedByName.set(c.name, c.value);
                    for (const c of solvedCookies) mergedByName.set(c.name, c.value);
                    const merged = Array.from(mergedByName.entries()).map(([name, value]) => ({ name, value }));
                    const toPersist: any = { cookies: merged, userAgent: sol.userAgent || storedUserAgent };
                    await db.forum.update({
                        where: { id: forumId },
                        data: { persistentCookies: JSON.stringify(toPersist), cookiesUpdatedAt: new Date() },
                    });
                    persistedCookies = merged;
                    storedUserAgent = toPersist.userAgent;
                }
            }
            return sol.response || '';
        };

        const tryAxios = async (url: string, config?: any) => {
            const res = await axiosClient.get(url, config);
            const body = String(res.data || '');
            const looksLikeChallenge = res.status === 403 || body.includes('cf-mitigated') || body.includes('Just a moment');
            if (looksLikeChallenge) throw Object.assign(new Error('Cloudflare challenge'), { response: { status: res.status } });
            return body;
        };

        // Step 1: Login if credentials provided (use FlareSolverr for reliability, but preload jar and persist)
        let sessionCookies: Array<{ name: string; value: string }> = [];
        if (username && password && fsClient) {
            const loginResult = await loginToForum(forumBaseUrl, username, password, flareUrl!);
            if (!loginResult.success) {
                return { success: false, error: `Login failed: ${loginResult.error}` };
            }
            sessionCookies = loginResult.cookies || [];
            if (sessionCookies.length > 0) {
                await preloadJarCookies(jar, forumBaseUrl, sessionCookies);
                if (forumId) {
                    const mergedByName = new Map<string, string>();
                    for (const c of persistedCookies) mergedByName.set(c.name, c.value);
                    for (const c of sessionCookies) mergedByName.set(c.name, c.value);
                    const merged = Array.from(mergedByName.entries()).map(([name, value]) => ({ name, value }));
                    await db.forum.update({
                        where: { id: forumId },
                        data: { persistentCookies: JSON.stringify({ cookies: merged, userAgent: storedUserAgent }), cookiesUpdatedAt: new Date() },
                    });
                    persistedCookies = merged;
                }
            }
        }

        // Step 2: Navigate to post (axios-first)
        let html = '';
        try {
            html = await tryAxios(postUrl);
        } catch {
            html = await useFlareSolverr(postUrl, 'GET');
            try {
                html = await tryAxios(postUrl);
            } catch {
                // keep solver html
            }
        }

        if (!html) {
            console.log('[LinkExtractor] ✗ No HTML received from FlareSolverr');
            return { success: false, error: 'No HTML content received from post' };
        }
        console.log('[LinkExtractor] ✓ Received HTML:', html.length, 'bytes');

        // Step 3: Parse HTML to find post ID and thanks button
        // Support both thread ID (?t=) and post ID (?p=)
        let postIdMatch = postUrl.match(/[?&](?:p|t)=(\d+)/);
        if (!postIdMatch) {
            return { success: false, error: 'Could not extract post ID from URL' };
        }
        let postId = postIdMatch[1];
        console.log('[LinkExtractor] Initial post ID from URL:', postId);

        // If URL has thread ID (?t=), extract the real post ID from HTML
        if (postUrl.match(/[?&]t=/)) {
            const realPostIdMatch = html.match(/id="vfc_(?:hide|unhide)_thanks_post_(\d+)"/);
            if (realPostIdMatch) {
                postId = realPostIdMatch[1];
                console.log('[LinkExtractor] Real post ID from HTML:', postId);
            }
        }

        // Check if thanks button exists (user hasn't clicked yet)
        const hiddenContentId = `vfc_hide_thanks_post_${postId}`;
        const unhiddenContentId = `vfc_unhide_thanks_post_${postId}`;

        // Check if content is already unhidden (user already clicked thanks)
        if (html.includes(`id="${unhiddenContentId}"`)) {
            console.log('[LinkExtractor] ✓ Content already unhidden, extracting links directly');
            return extractLinksFromHTML(html);
        }

        // Check if hidden content exists (needs to click thanks)
        if (!html.includes(`id="${hiddenContentId}"`)) {
            console.log('[LinkExtractor] ✗ No hidden or unhidden content found');
            console.log('[LinkExtractor] Looking for:', hiddenContentId, 'or', unhiddenContentId);

            // Debug: find all divs with vfc_ pattern
            const vfcMatches = html.match(/id="(vfc_[^"]+)"/g);
            if (vfcMatches) {
                console.log('[LinkExtractor] Found vfc_ divs:', vfcMatches.slice(0, 10));
            } else {
                console.log('[LinkExtractor] No vfc_ divs found in HTML');
            }

            return { success: false, error: 'No hidden content found (thanks mechanism not detected)' };
        }

        console.log('[LinkExtractor] Content is hidden, searching for thanks button');

        // Step 4: Find and construct thanks URL
        // Pattern: href="post_thanks.php?do=post_thanks_add&amp;p=2304&amp;securitytoken=..."
        const allThanksLinks = Array.from(
            html.matchAll(/href=['"](post_thanks\.php[^'\"]+)['"]/gi)
        ).map((m) => m[1]);

        console.log('[LinkExtractor] post_thanks links found:', allThanksLinks.length);
        if (allThanksLinks.length > 0) {
            console.log('[LinkExtractor] Sample links:', allThanksLinks.slice(0, 5));
        }

        const thanksRegex = new RegExp(
            `href=['"](post_thanks\\.php[^'\"]*(?:[?&]|&amp;)p=${postId}[^'\"]*)['"]`,
            'i'
        );
        const thanksButtonMatch = html.match(thanksRegex);
        let thanksUrl: string | null = null;

        if (!thanksButtonMatch) {
            // Fallback: construct default thanks URL even if button is not present in HTML
            thanksUrl = new URL(`/post_thanks.php?do=post_thanks_add&p=${postId}`, forumBaseUrl).toString();
            console.log('[LinkExtractor] ⚠️ Thanks button not found, using fallback URL:', thanksUrl);
        } else {
            console.log('[LinkExtractor] ✓ Found thanks button');
            const thanksPath = thanksButtonMatch[1]
                .replace(/&amp;/g, '&')  // Decode HTML entities
                .replace(/^\//, '');
            thanksUrl = new URL(thanksPath, forumBaseUrl).toString();
            console.log('[LinkExtractor] Thanks URL:', thanksUrl);
        }

        if (!thanksUrl) {
            return { success: false, error: 'Thanks button not found in HTML' };
        }

        // Step 5: Click thanks button (axios-first)
        let thanksClicked = false;
        try {
            await tryAxios(thanksUrl);
            thanksClicked = true;
        } catch (axiosErr) {
            try {
                await useFlareSolverr(thanksUrl, 'GET');
                thanksClicked = true;
            } catch (solverErr) {
                console.log('[LinkExtractor] ✗ Failed to click thanks URL via axios and FlareSolverr', axiosErr, solverErr);
            }
        }

        if (!thanksClicked) {
            return { success: false, error: 'Failed to click thanks button' };
        }

        // Step 6: Re-fetch post to get unhidden content
        let updatedHtml = '';
        try {
            updatedHtml = await tryAxios(postUrl);
        } catch {
            updatedHtml = await useFlareSolverr(postUrl, 'GET');
        }

        // Step 7: Extract links from unhidden content
        return extractLinksFromHTML(updatedHtml);

    } catch (error) {
        console.error('[LinkExtractor] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Extract URLs from HTML containing unhidden content
 * Looks for <pre class="bbcode_code"> and extracts URLs line by line
 */
function extractLinksFromHTML(html: string): ExtractLinksResult {
    try {
        // Match <pre class="bbcode_code">...</pre>
        const preMatch = html.match(/<pre[^>]*class="bbcode_code"[^>]*>([\s\S]*?)<\/pre>/i);

        if (!preMatch) {
            return { success: false, error: 'No bbcode_code block found in unhidden content' };
        }

        const preContent = preMatch[1];

        // Extract URLs (split by newlines, filter empty lines and non-URLs)
        const lines = preContent
            .split(/[\r\n]+/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // Filter lines that look like URLs
        const urls = lines.filter(line =>
            line.startsWith('http://') ||
            line.startsWith('https://') ||
            line.includes('://') // Catch other protocols
        );

        if (urls.length === 0) {
            return { success: false, error: 'No URLs found in unhidden content' };
        }

        console.log(`[LinkExtractor] Extracted ${urls.length} links`);
        return { success: true, links: urls };

    } catch (error) {
        console.error('[LinkExtractor] HTML parsing error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'HTML parsing failed',
        };
    }
}
