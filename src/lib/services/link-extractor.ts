import { FlareSolverrClient } from './flaresolverr-client';
import { sessionManager } from './flaresolverr-session-manager';
import axios from 'axios';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { db } from '@/lib/db';
import { getJarForHost, preloadJarCookies } from '@/lib/cookie-jar-store';
import { logger } from '../logger';
import * as cheerio from 'cheerio';

interface ExtractLinksResult {
    success: boolean;
    links?: string[];
    error?: string;
}

interface ParsingConfig {
    thankButtonSelector?: string;
    linksContainerSelector?: string;
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
    fsClient: FlareSolverrClient,
    sessionId?: string
): Promise<LoginResult> {
    try {
        // Warm up base URL to obtain CF cookies
        logger.info('extract', `Warming up forum base URL: ${baseUrl}`);
        const warm = await fsClient.request(baseUrl, 'GET', undefined, sessionId);

        // Perform vBulletin login POST
        logger.info('extract', `Attempting login for user: ${username}`);
        const postData = {
            do: 'login',
            vb_login_username: username,
            vb_login_password: password,
            s: '',
            securitytoken: 'guest',
            url: `${baseUrl}/forum.php`,
            cookieuser: '1',
        };

        const login = await fsClient.request(`${baseUrl}/login.php?do=login`, 'POST', postData, sessionId);
        const loginHtml = login.response || '';

        // Check for vBulletin login error messages
        if (
            loginHtml.includes('nombre de usuario o contraseña no válidos') ||
            loginHtml.includes('incorrect') ||
            loginHtml.includes('invalid username or password') ||
            loginHtml.includes('has introducido un nombre de usuario o contraseña')
        ) {
            logger.warn('extract', 'Login failed: invalid credentials');
            return { success: false, error: 'Invalid credentials' };
        }

        // Verify session cookies
        const hasSessionCookie = login.cookies.some(
            (c) => c.name.startsWith('bb') || c.name.includes('session') || c.name.includes('userid')
        );

        if (!hasSessionCookie) {
            logger.warn('extract', 'Login failed: no session cookies');
            return { success: false, error: 'No session cookies received' };
        }

        logger.info('extract', 'Login successful');
        return { success: true, cookies: login.cookies };
    } catch (error) {
        logger.error('extract', `Login error: ${error instanceof Error ? error.message : String(error)}`);
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
    forumId?: string,
    parsingConfig?: ParsingConfig
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
        let ttlMs = 30 * 60 * 1000;
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
            ttlMs = forum?.flaresolverrSessionTTL || ttlMs;
        }
        if (persistedCookies.length > 0) {
            await preloadJarCookies(jar, postUrl, persistedCookies);
        }

        const fsClient = flareUrl ? new FlareSolverrClient(flareUrl) : null;
        let sessionId: string | undefined;
        if (fsClient && forumId) {
            sessionId = await sessionManager.getSession(forumId, host, ttlMs, fsClient);
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

        const callFlareSolverr = async (url: string, method: 'GET' | 'POST' = 'GET', postData?: Record<string, any>) => {
            if (!fsClient) throw new Error('FlareSolverr URL not configured');
            const sol = await fsClient.request(url, method, postData, sessionId);
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
            const loginResult = await loginToForum(forumBaseUrl, username, password, fsClient, sessionId);
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
            html = await callFlareSolverr(postUrl, 'GET');
            try {
                html = await tryAxios(postUrl);
            } catch {
                // keep solver html
            }
        }

        if (!html) {
            logger.warn('extract', 'No HTML received from post URL');
            return { success: false, error: 'No HTML content received from post' };
        }
        logger.info('extract', `Received HTML: ${html.length} bytes`);

        let $: cheerio.CheerioAPI | null = null;
        const loadDom = () => {
            if (!$) {
                $ = cheerio.load(html);
            }
            return $;
        };

        // Step 3: Parse HTML to find post ID and thanks button
        // Support both thread ID (?t=) and post ID (?p=)
        let postIdMatch = postUrl.match(/[?&](?:p|t)=(\d+)/);
        if (!postIdMatch) {
            return { success: false, error: 'Could not extract post ID from URL' };
        }
        let postId = postIdMatch[1];
        logger.info('extract', `Initial post ID from URL: ${postId}`);

        // If URL has thread ID (?t=), extract the real post ID from HTML
        if (postUrl.match(/[?&]t=/)) {
            const realPostIdMatch = html.match(/id="vfc_(?:hide|unhide)_thanks_post_(\d+)"/);
            if (realPostIdMatch) {
                postId = realPostIdMatch[1];
                logger.info('extract', `Real post ID from HTML: ${postId}`);
            }
        }

        // Check if thanks button exists (user hasn't clicked yet)
        const hiddenContentId = `vfc_hide_thanks_post_${postId}`;
        const unhiddenContentId = `vfc_unhide_thanks_post_${postId}`;

        // Check if content is already unhidden (user already clicked thanks)
        if (html.includes(`id="${unhiddenContentId}"`)) {
            logger.info('extract', 'Content already unhidden, extracting links directly');
            return extractLinksFromHTML(html, parsingConfig?.linksContainerSelector);
        }

        // Check if hidden content exists (needs to click thanks)
        const hasHiddenContent = html.includes(`id="${hiddenContentId}"`);
        if (!hasHiddenContent) {
            logger.warn('extract', `No hidden or unhidden content found. Looking for: ${hiddenContentId} or ${unhiddenContentId}`);

            // Debug: find all divs with vfc_ pattern
            const vfcMatches = html.match(/id="(vfc_[^"]+)"/g);
            if (vfcMatches) {
                logger.info('extract', `Found vfc_ divs: ${vfcMatches.slice(0, 10).join(', ')}`);
            } else {
                logger.info('extract', 'No vfc_ divs found in HTML');
            }

            // If we have a custom thank button selector, allow extraction even without the vfc markers
            if (!parsingConfig?.thankButtonSelector) {
                return { success: false, error: 'No hidden content found (thanks mechanism not detected)' };
            }
        }

        logger.info('extract', 'Content is hidden, searching for thanks button');

        // Step 4: Find and construct thanks URL
        // Pattern: href="post_thanks.php?do=post_thanks_add&amp;p=2304&amp;securitytoken=..."
        let thanksUrl: string | null = null;

        // Prefer a configured selector when available
        if (parsingConfig?.thankButtonSelector) {
            try {
                const dom = loadDom();
                const thanksEl = dom(parsingConfig.thankButtonSelector).first();
                if (thanksEl && thanksEl.length > 0) {
                    const href = thanksEl.attr('href') || thanksEl.attr('data-url');
                    if (href) {
                        const normalized = href.startsWith('http')
                            ? href
                            : new URL(href.replace(/^\//, ''), forumBaseUrl).toString();
                        thanksUrl = normalized;
                        logger.info('extract', `Thanks URL resolved via selector: ${thanksUrl}`);
                    }
                }
            } catch (selectorErr) {
                logger.warn('extract', `Failed to resolve thanks button via selector: ${selectorErr}`);
            }
        }

        // Fallback to regex search when selector did not produce a URL
        if (!thanksUrl) {
            const allThanksLinks = Array.from(
                html.matchAll(/href=['"](post_thanks\.php[^'\"]+)['"]/gi)
            ).map((m) => m[1]);

            logger.info('extract', `post_thanks links found: ${allThanksLinks.length}`);
            if (allThanksLinks.length > 0) {
                logger.info('extract', `Sample links: ${allThanksLinks.slice(0, 5).join(', ')}`);
            }

            const thanksRegex = new RegExp(
                `href=['"](post_thanks\\.php[^'\"]*(?:[?&]|&amp;)p=${postId}[^'\"]*)['"]`,
                'i'
            );
            const thanksButtonMatch = html.match(thanksRegex);

            if (!thanksButtonMatch) {
                // Fallback: construct default thanks URL even if button is not present in HTML
                thanksUrl = new URL(`/post_thanks.php?do=post_thanks_add&p=${postId}`, forumBaseUrl).toString();
                logger.warn('extract', `Thanks button not found, using fallback URL: ${thanksUrl}`);
            } else {
                logger.info('extract', 'Found thanks button via regex');
                const thanksPath = thanksButtonMatch[1]
                    .replace(/&amp;/g, '&')  // Decode HTML entities
                    .replace(/^\//, '');
                thanksUrl = new URL(thanksPath, forumBaseUrl).toString();
                logger.info('extract', `Thanks URL: ${thanksUrl}`);
            }
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
                await callFlareSolverr(thanksUrl, 'GET');
                thanksClicked = true;
            } catch (solverErr) {
                logger.error('extract', `Failed to click thanks URL via axios and FlareSolverr: ${axiosErr}, ${solverErr}`);
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
            updatedHtml = await callFlareSolverr(postUrl, 'GET');
        }

        // Step 7: Extract links from unhidden content
        return extractLinksFromHTML(updatedHtml, parsingConfig?.linksContainerSelector);

    } catch (error) {
        logger.error('extract', `Error: ${error instanceof Error ? error.message : String(error)}`);
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
function extractLinksFromHTML(html: string, linksContainerSelector?: string): ExtractLinksResult {
    try {
        const $ = cheerio.load(html);
        const collected: string[] = [];

        const pushLink = (value: string | undefined) => {
            if (!value) return;
            const normalized = value.trim();
            if (!/^https?:\/\//i.test(normalized)) return;
            collected.push(normalized);
        };

        // Try user-defined container selector first
        if (linksContainerSelector) {
            const container = $(linksContainerSelector);
            if (container && container.length > 0) {
                container.find('a[href]').each((_, el) => pushLink($(el).attr('href')));
                container.find('pre, code').each((_, el) => {
                    const text = $(el).text();
                    const urlMatches = text.match(/https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/gi);
                    urlMatches?.forEach(pushLink);
                });
            }
        }

        // Fallback: bbcode_code blocks anywhere in the document
        $('pre.bbcode_code').each((_, el) => {
            const text = $(el).text();
            const urlMatches = text.match(/https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/gi);
            urlMatches?.forEach(pushLink);
        });

        // Additional fallback: any links in the document
        if (collected.length === 0) {
            $('a[href]').each((_, el) => pushLink($(el).attr('href')));
        }

        const unique = Array.from(new Set(collected));

        if (unique.length === 0) {
            return { success: false, error: 'No URLs found in unhidden content' };
        }

        logger.info('extract', `Extracted ${unique.length} links`);
        return { success: true, links: unique };

    } catch (error) {
        logger.error('extract', `HTML parsing error: ${error instanceof Error ? error.message : String(error)}`);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'HTML parsing failed',
        };
    }
}

/**
 * Shared link extraction helpers used by both testing and grab endpoints
 * Extracts download links from HTML content using hosting-specific patterns
 */

export interface ExtractedLinkInfo {
    url: string;
    hosting: string;
    filename?: string;
}

/**
 * Extract download links from HTML and categorize by hosting provider
 * Used by both /api/testing/extract-links and /api/arr/grab
 */
export function extractDownloadLinksFromHtml(html: string, baseUrl?: string): ExtractedLinkInfo[] {
    const links: ExtractedLinkInfo[] = [];

    // Common download hosting patterns
    const hostingPatterns = [
        { name: 'Mega', regex: /https?:\/\/mega\.nz\/[^\s"'<>]*/gi },
        { name: '1fichier', regex: /https?:\/\/1fichier\.com\/[^\s"'<>]*/gi },
        { name: 'Uploaded', regex: /https?:\/\/uploaded\.net\/[^\s"'<>]*/gi },
        { name: 'Rapidgator', regex: /https?:\/\/rapidgator\.net\/[^\s"'<>]*/gi },
        { name: 'Nitroflare', regex: /https?:\/\/nitroflare\.com\/[^\s"'<>]*/gi },
        { name: 'Turbobit', regex: /https?:\/\/turbobit\.net\/[^\s"'<>]*/gi },
        { name: 'Mediafire', regex: /https?:\/\/(?:www\.)?mediafire\.com\/[^\s"'<>]*/gi },
        { name: 'Uptobox', regex: /https?:\/\/uptobox\.com\/[^\s"'<>]*/gi },
        { name: 'Katfile', regex: /https?:\/\/katfile\.com\/[^\s"'<>]*/gi },
        { name: 'Filefactory', regex: /https?:\/\/filefactory\.com\/[^\s"'<>]*/gi },
    ];

    // Extract links for each hosting service
    for (const pattern of hostingPatterns) {
        let match;
        while ((match = pattern.regex.exec(html)) !== null) {
            const url = match[0];

            // Skip if already added
            if (links.some(l => l.url === url)) continue;

            // Try to extract filename from URL
            const filename = extractFilenameFromUrl(url);

            links.push({
                url,
                hosting: pattern.name,
                filename,
            });
        }
    }

    // Also look for generic download links (http/https followed by common extensions)
    const genericLinkRegex = /https?:\/\/[^\s"'<>]+\.(rar|zip|7z|mkv|mp4|avi|iso|exe|pdf)/gi;
    let match;
    while ((match = genericLinkRegex.exec(html)) !== null) {
        const url = match[0];

        // Skip if already added
        if (links.some(l => l.url === url)) continue;

        // Determine hosting from domain
        const domain = new URL(url).hostname.replace('www.', '');
        const hosting = domain.split('.')[0];

        links.push({
            url,
            hosting: hosting.charAt(0).toUpperCase() + hosting.slice(1),
            filename: extractFilenameFromUrl(url),
        });
    }

    return links;
}

function extractFilenameFromUrl(url: string): string | undefined {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop();

        if (filename && filename.includes('.')) {
            return decodeURIComponent(filename);
        }
    } catch (err) {
        // Invalid URL, ignore
    }

    return undefined;
}

/**
 * Core function: Extract links from a forum post with automatic "Thanks" button detection and clicking
 * 
 * This function encapsulates the COMPLETE flow:
 * 1. Load forum config and get persisted cookies
 * 2. Optionally login (if credentials provided)
 * 3. Fetch the post HTML
 * 4. Detect if "Thanks" button exists
 * 5. If needed, click the thanks button and refetch
 * 6. Extract download links from the revealed content
 * 
 * Used by both /api/testing/extract-links and /api/arr/grab endpoints
 * 
 * @param forumId - Forum database ID to lookup credentials and cached cookies
 * @param postUrl - Full URL to the forum post
 * @returns Object with success flag and extracted links (or error message)
 */
export async function extractLinksFromPostWithThankClick(
    forumId: string,
    postUrl: string
): Promise<{ success: boolean; links: ExtractedLinkInfo[]; error?: string }> {
    try {
        logger.info('extract-shared', `Starting link extraction for forum=${forumId}, url=${postUrl}`);

        // Step 1: Load forum config
        const forum = await db.forum.findUnique({
            where: { id: forumId },
            include: { credentials: true },
        });

        if (!forum) {
            logger.error('extract-shared', `Forum not found: ${forumId}`);
            return { success: false, links: [], error: 'Forum not found' };
        }

        if (!forum.enabled) {
            logger.warn('extract-shared', `Forum disabled: ${forumId}`);
            return { success: false, links: [], error: 'Forum is disabled' };
        }

        logger.info('extract-shared', `Forum loaded: ${forum.name}`);

        // Step 2: Initialize axios client with persisted cookies
        const host = new URL(postUrl).hostname;
        const jar: CookieJar = getJarForHost(host);
        
        let parsedCookies = forum.persistentCookies ? JSON.parse(forum.persistentCookies) : [];
        const cookieArr: Array<{ name: string; value: string; domain?: string; path?: string }> = Array.isArray(parsedCookies)
            ? parsedCookies
            : parsedCookies && typeof parsedCookies === 'object'
                ? Array.isArray((parsedCookies as any).cookies) ? (parsedCookies as any).cookies : []
                : [];
        let storedUserAgent: string | undefined = parsedCookies && typeof parsedCookies === 'object' && typeof (parsedCookies as any).userAgent === 'string'
            ? (parsedCookies as any).userAgent
            : undefined;

        if (cookieArr.length > 0) {
            await preloadJarCookies(jar, postUrl, cookieArr);
            logger.info('extract-shared', `Loaded ${cookieArr.length} persisted cookies for ${host}`);
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
                'Referer': forum.baseUrl || `https://${host}/`,
            },
            timeout: 20000,
        }));

        const flaresolverrUrl = process.env.FLARESOLVERR_URL;
        const fsClient = flaresolverrUrl ? new FlareSolverrClient(flaresolverrUrl) : null;

        // Helper: Try request with FlareSolverr fallback
        const useFlareSolverr = async (url: string) => {
            if (!fsClient) {
                logger.error('extract-shared', 'FlareSolverr not configured');
                throw new Error('FlareSolverr URL not configured');
            }
            logger.info('extract-shared', `Using FlareSolverr for ${url}`);
            const solution = await fsClient.request(url, 'GET');
            const solvedCookies = solution.cookies || [];
            if (solvedCookies.length > 0) {
                await preloadJarCookies(jar, url, solvedCookies);
                const mergedByName = new Map<string, string>();
                for (const c of cookieArr) mergedByName.set(c.name, c.value);
                for (const c of solvedCookies) mergedByName.set(c.name, c.value);
                const merged = Array.from(mergedByName.entries()).map(([name, value]) => ({ name, value }));
                const toPersist: any = { cookies: merged, userAgent: solution.userAgent || storedUserAgent };
                await db.forum.update({
                    where: { id: forum.id },
                    data: { persistentCookies: JSON.stringify(toPersist), cookiesUpdatedAt: new Date() },
                });
                logger.info('extract-shared', `Persisted ${merged.length} cookies after FlareSolverr`);
            }
            return solution.response || '';
        };

        const tryAxios = async (url: string) => {
            const res = await axiosClient.get(url);
            const body = String(res.data || '');
            const looksLikeChallenge = res.status === 403 || body.includes('cf-mitigated') || body.includes('Just a moment');
            if (looksLikeChallenge) {
                logger.warn('extract-shared', `Cloudflare challenge detected (status ${res.status})`);
                throw Object.assign(new Error('Cloudflare challenge'), { response: { status: res.status } });
            }
            return body;
        };

        // Step 3: Optionally login with credentials
        if (forum.credentials?.username && forum.credentials?.password) {
            logger.info('extract-shared', `Attempting login with credentials for ${forum.credentials.username}`);
            if (fsClient) {
                const loginResult = await loginToForum(
                    forum.baseUrl,
                    forum.credentials.username,
                    forum.credentials.password,
                    fsClient
                );
                if (!loginResult.success) {
                    logger.error('extract-shared', `Login failed: ${loginResult.error}`);
                    return { success: false, links: [], error: `Login failed: ${loginResult.error}` };
                }
                const sessionCookies = loginResult.cookies || [];
                if (sessionCookies.length > 0) {
                    await preloadJarCookies(jar, forum.baseUrl, sessionCookies);
                    const mergedByName = new Map<string, string>();
                    for (const c of cookieArr) mergedByName.set(c.name, c.value);
                    for (const c of sessionCookies) mergedByName.set(c.name, c.value);
                    const merged = Array.from(mergedByName.entries()).map(([name, value]) => ({ name, value }));
                    await db.forum.update({
                        where: { id: forumId },
                        data: { persistentCookies: JSON.stringify({ cookies: merged, userAgent: storedUserAgent }), cookiesUpdatedAt: new Date() },
                    });
                    logger.info('extract-shared', `Login successful, persisted ${merged.length} cookies`);
                }
            }
        }

        // Step 4: Fetch post HTML
        logger.info('extract-shared', `Fetching post: ${postUrl}`);
        let html = '';
        try {
            html = await tryAxios(postUrl);
            logger.info('extract-shared', `✓ Axios succeeded (${html.length} bytes)`);
        } catch (firstErr: any) {
            const status = firstErr?.response?.status;
            logger.warn('extract-shared', `✗ Axios failed (status ${status}), trying FlareSolverr...`);
            html = await useFlareSolverr(postUrl);
            // Try axios again after FlareSolverr
            try {
                html = await tryAxios(postUrl);
                logger.info('extract-shared', `✓ Axios succeeded after FlareSolverr`);
            } catch {
                logger.warn('extract-shared', `Using FlareSolverr HTML directly`);
            }
        }

        if (!html || html.length === 0) {
            logger.error('extract-shared', 'No HTML content received');
            return { success: false, links: [], error: 'No HTML content received' };
        }

        // Step 5: Check if "Thanks" button exists and needs clicking
        const thanksLinkRegex = /thanks\.php\?do=post&(?:amp;)?postid=(\d+)/i;
        const thanksMatch = html.match(thanksLinkRegex);

        if (thanksMatch) {
            logger.info('extract-shared', `Found thanks button, constructing URL...`);
            const thanksHref = thanksMatch[0];
            const thanksUrl = thanksHref.startsWith('http')
                ? thanksHref
                : `${forum.baseUrl}/${thanksHref}`;

            logger.info('extract-shared', `Clicking thanks URL: ${thanksUrl}`);

            try {
                await tryAxios(thanksUrl);
                logger.info('extract-shared', `✓ Thanks click via axios`);
            } catch (err: any) {
                logger.warn('extract-shared', `✗ Axios thanks failed, using FlareSolverr`);
                try {
                    await useFlareSolverr(thanksUrl);
                    logger.info('extract-shared', `✓ Thanks click via FlareSolverr`);
                } catch (solverErr) {
                    logger.error('extract-shared', `Failed to click thanks: ${solverErr}`);
                    return { success: false, links: [], error: 'Failed to click thanks button' };
                }
            }

            // Step 6: Refetch post to reveal hidden content
            logger.info('extract-shared', `Refetching post after thanks click...`);
            try {
                html = await tryAxios(postUrl);
                logger.info('extract-shared', `✓ Post refetch succeeded`);
            } catch {
                logger.warn('extract-shared', `Axios refetch failed, using FlareSolverr`);
                html = await useFlareSolverr(postUrl);
            }
        } else {
            logger.info('extract-shared', `No thanks button found (content may already be revealed)`);
        }

        // Step 7: Extract download links from HTML
        logger.info('extract-shared', `Extracting download links from HTML...`);
        const links = extractDownloadLinksFromHtml(html, forum.baseUrl);
        logger.info('extract-shared', `✓ Extracted ${links.length} links`);

        return { success: true, links };

    } catch (error) {
        logger.error('extract-shared', `Error: ${error instanceof Error ? error.message : String(error)}`);
        return {
            success: false,
            links: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
