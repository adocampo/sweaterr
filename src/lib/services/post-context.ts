import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import { sessionManager } from '@/lib/services/flaresolverr-session-manager';
import { getFlareSolverrSettings } from '@/lib/services/flaresolverr-config';
import { logger } from '@/lib/logger';

export interface PostContext {
    url: string;
    title?: string;
    breadcrumbs?: string;
    /** Text of the opening post, where the synopsis and technical sheet live. */
    firstPostText?: string;
    error?: string;
}

const FIRST_POST_SELECTORS = [
    '[id^="post_message_"]',
    '.postcontent',
    '.post_body',
    '.message-body .bbWrapper',
    'article .message-body',
    '.postbody .content',
    '.entry-content',
];

const TITLE_SELECTORS = '.threadtitle, #thread_title, h1, h2';

/** Where the release facts live: the technical sheet and the collapsed MEDIAINFO block. */
const TECH_SHEET_MARKER = /(datos\s+t[eé]cnicos|ficha\s+t[eé]cnica|mediainfo|subt[ií]tulos?\s*:|audio\s*(#\d+)?\s*:|idiomas?\s*:|calidad\s*:)/i;

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

/** Line breaks matter: MEDIAINFO is a key/value list and collapses into noise without them. */
function blockText($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): string {
    element.find('br').replaceWith('\n');
    element.find('p, div, li, tr, h1, h2, h3').append('\n');
    return element
        .text()
        .replace(/[ \t\u00a0]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
}

/** Trims around the technical sheet instead of cutting the post at an arbitrary point. */
function focusOnTechnicalSheet(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;

    const marker = text.search(TECH_SHEET_MARKER);
    if (marker === -1) return text.slice(0, maxChars);

    const start = Math.max(0, marker - 500);
    return text.slice(start, start + maxChars);
}

function extractFirstPost($: cheerio.CheerioAPI, maxChars: number): string {
    for (const selector of FIRST_POST_SELECTORS) {
        const element = $(selector).first();
        if (element.length === 0) continue;
        const text = blockText($, element);
        if (text.length > 60) return focusOnTechnicalSheet(text, maxChars);
    }
    return focusOnTechnicalSheet(blockText($, $('body')), maxChars);
}

/**
 * Fetches the opening post of each thread so the LLM can read the synopsis,
 * year and technical sheet instead of guessing from the title alone.
 */
export async function fetchPostContexts(
    forumId: string,
    urls: string[],
    options: { maxChars?: number } = {}
): Promise<Map<string, PostContext>> {
    const maxChars = options.maxChars ?? Number.POSITIVE_INFINITY;
    const contexts = new Map<string, PostContext>();

    const flaresolverrSettings = await getFlareSolverrSettings();

    const forum = await db.forum.findUnique({ where: { id: forumId } });
    if (!forum) {
        for (const url of urls) contexts.set(url, { url, error: 'Forum not found' });
        return contexts;
    }

    // Only follow URLs that belong to the configured forum, never arbitrary hosts.
    let allowedHost: string;
    try {
        allowedHost = new URL(forum.baseUrl).hostname;
    } catch {
        for (const url of urls) contexts.set(url, { url, error: 'Forum baseUrl is invalid' });
        return contexts;
    }

    const flaresolverrUrl = forum.useFlaresolverr && flaresolverrSettings.enabled ? flaresolverrSettings.url : null;
    const fsClient = flaresolverrUrl ? new FlareSolverrClient(flaresolverrUrl) : null;
    const ttlMs = forum.flaresolverrSessionTTL || 30 * 60 * 1000;
    let sessionId: string | undefined;

    for (const url of urls) {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            contexts.set(url, { url, error: 'Invalid URL' });
            continue;
        }

        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            contexts.set(url, { url, error: 'Unsupported protocol' });
            continue;
        }

        if (parsed.hostname !== allowedHost) {
            contexts.set(url, { url, error: 'URL does not belong to the forum' });
            continue;
        }

        try {
            if (fsClient && !sessionId) {
                sessionId = await sessionManager.getSession(forumId, allowedHost, ttlMs, fsClient);
            }

            const html = fsClient
                ? (await fsClient.request(url, 'GET', undefined, sessionId, undefined, undefined, {
                    maxTimeout: flaresolverrSettings.timeout,
                    requestTimeout: flaresolverrSettings.timeout + 15000,
                })).response || ''
                : await fetch(url, { headers: { Accept: 'text/html', 'Accept-Language': 'es-ES,es;q=0.9' } }).then((response) => {
                    if (!response.ok) throw new Error(`Direct request failed: HTTP ${response.status}`);
                    return response.text();
                });
            if (!html) {
                contexts.set(url, { url, error: 'Empty response' });
                continue;
            }

            const $ = cheerio.load(html);
            const breadcrumbs = ['.breadcrumb', '.navbar', '#breadcrumb', '.page-breadcrumb']
                .map((selector) => normalizeWhitespace($(selector).text() || ''))
                .filter(Boolean)
                .join(' | ')
                .slice(0, 400);

            const firstPostText = extractFirstPost($, maxChars);
            logger.info(
                'post-context',
                `Fetched ${url}: ${firstPostText.length} chars, tech sheet ${TECH_SHEET_MARKER.test(firstPostText) ? 'found' : 'NOT found'}, mediainfo ${/mediainfo/i.test(firstPostText) ? 'found' : 'NOT found'}`
            );

            contexts.set(url, {
                url,
                title: normalizeWhitespace(
                    $(forum.postTitleSelector || TITLE_SELECTORS).first().text() || $('title').first().text() || ''
                ),
                breadcrumbs,
                firstPostText,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('post-context', `Failed to fetch ${url}: ${message}`);
            contexts.set(url, { url, error: message });
        }
    }

    return contexts;
}
