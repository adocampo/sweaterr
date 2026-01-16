import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { CloudflareHandler } from './cloudflare-handler';
import { FlareSolverrClient } from './flaresolverr-client';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { extractSize, convertSizeToBytes } from '@/lib/metadata-extractor';

export interface ForumSearchResult {
  title: string;
  url: string;
  forum: string;
  date?: string;
  author?: string;
  replies?: number;
  views?: number;
  hasLinks?: boolean;
  thankRequired?: boolean;
  snippet?: string;
  size?: number; // File size in bytes, extracted from title or metadata
}

export interface ForumSearchResponse {
  results: ForumSearchResult[];
  searchId?: string; // For pagination in native vBulletin search
  totalResults?: number; // Total results available in this search
}

export interface ForumPost {
  title: string;
  content: string;
  links: string[];
  author: string;
  date: string;
  forum: string;
  thankRequired: boolean;
}

const HOSTER_HOST_REGEX = /(^|\.)(mega\.nz|pixeldrain\.com|1fichier\.com|uptobox\.com|rapidgator\.net|nitroflare\.com|katfile\.com|turbobit\.net|ddownload\.com|mediafire\.com|gofile\.io|krakenfiles\.com|send\.cm)$/i;

export interface ForumConfig {
  id: string;
  name: string;
  baseUrl: string;
  searchPath: string;
  searchMode?: 'native' | 'google_site' | 'google_cse';
  searchForumLabel?: string;
  searchTitleOnly?: boolean;
  searchInChildForums?: boolean;
  cseId?: string;
  thankButtonSelector?: string;
  linksContainerSelector?: string;
  postTitleSelector?: string;
  persistentCookies?: string;
  credentials?: {
    username: string;
    password: string;
  };
}

export class ForumService {
  private configs: Map<string, ForumConfig> = new Map();
  private clients: Map<string, AxiosInstance> = new Map();
  private cfHandler: CloudflareHandler | null = null;

  private parseStoredCookies(serialized?: string): { cookies: Array<{ name: string; value: string }>; userAgent?: string } {
    if (!serialized) return { cookies: [], userAgent: undefined };
    try {
      const parsed = JSON.parse(serialized);
      if (Array.isArray(parsed)) {
        return { cookies: parsed, userAgent: undefined };
      }
      if (parsed && typeof parsed === 'object') {
        const cookies = Array.isArray((parsed as any).cookies) ? (parsed as any).cookies : [];
        const userAgent = typeof (parsed as any).userAgent === 'string' ? (parsed as any).userAgent : undefined;
        return { cookies, userAgent };
      }
    } catch { }
    return { cookies: [], userAgent: undefined };
  }

  private parseCookieHeader(header?: string | string[]): Array<{ name: string; value: string }> {
    if (!header) return [];
    const raw = Array.isArray(header) ? header.join('; ') : header;
    return raw
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [name, ...rest] = part.split('=');
        return { name, value: rest.join('=') };
      })
      .filter(c => c.name && c.value);
  }

  private isAxiosBlockedByCloudflare(error: any): boolean {
    const status = error?.response?.status;
    if (status === 403 || status === 429 || status === 503) return true;
    const body = String(error?.response?.data || '');
    if (!body) return false;
    return /cloudflare|turnstile|cf-ray/i.test(body);
  }

  private async fetchHtmlWithFallback(forumId: string, url: string): Promise<string> {
    const config = this.configs.get(forumId);
    const client = this.clients.get(forumId);
    if (!config || !client) {
      throw new Error(`Forum ${forumId} not configured`);
    }

    try {
      const res = await client.get(url);
      return String(res.data || '');
    } catch (error: any) {
      if (!this.isAxiosBlockedByCloudflare(error)) {
        throw error;
      }

      const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;
      if (!flaresolverrUrl) {
        throw error;
      }

      logger.warn('forum', `[${config.name}] Cloudflare/403 detected; retrying via FlareSolverr`);

      const fsClient = new FlareSolverrClient(flaresolverrUrl);
      const { cookies: storedCookies, userAgent: storedUserAgent } = this.parseStoredCookies(config.persistentCookies);
      const cookieHeader = FlareSolverrClient.cookiesToHeader(storedCookies as any);
      const headers: Record<string, string> = {
        ...(storedUserAgent ? { 'User-Agent': storedUserAgent } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        'Accept-Language': 'es-ES,es;q=0.9',
      };

      const solution = await fsClient.request(url, 'GET', undefined, undefined, headers, storedCookies as any, {
        maxTimeout: 45000,
        requestTimeout: 60000,
      });

      return String(solution.response || '');
    }
  }

  // Add forum configuration
  addForum(config: ForumConfig): void {
    logger.info('forum', `addForum: Configuring forum ${config.id} (${config.name})`);
    this.configs.set(config.id, config);

    // Create authenticated axios instance
    const client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Add request/response interceptors for logging
    client.interceptors.request.use(req => {
      logger.info('forum', `${config.name}: ${req.method?.toUpperCase()} ${req.url}`);
      return req;
    });

    client.interceptors.response.use(res => {
      logger.info('forum', `${config.name}: Response ${res.status} from ${res.config.url}`);
      return res;
    });

    // Apply persistent cookies if available
    const { cookies: storedCookies, userAgent: storedUserAgent } = this.parseStoredCookies(config.persistentCookies);
    if (storedCookies.length > 0) {
      const cookieHeader = storedCookies.map(c => `${c.name}=${c.value}`).join('; ');
      client.defaults.headers.Cookie = cookieHeader;
      logger.info('forum', `Applied persistent cookies to ${config.name} (${storedCookies.length})`);
    }
    if (storedUserAgent) {
      client.defaults.headers['User-Agent'] = storedUserAgent;
      logger.info('forum', `Applied stored user agent for ${config.name}`);
    }

    this.clients.set(config.id, client);
  }

  // Authenticate with forum
  async authenticate(forumId: string): Promise<boolean> {
    const config = this.configs.get(forumId);
    const client = this.clients.get(forumId);

    if (!config || !client) {
      logger.warn('forum', `Forum not configured: ${forumId}`);
      return false;
    }

    // If we already have persistent cookies, apply and skip login
    const { cookies: storedCookies, userAgent: storedUserAgent } = this.parseStoredCookies(config.persistentCookies);
    if (storedCookies.length > 0) {
      const cookieHeader = storedCookies.map(c => `${c.name}=${c.value}`).join('; ');
      client.defaults.headers.Cookie = cookieHeader;
      if (storedUserAgent) {
        client.defaults.headers['User-Agent'] = storedUserAgent;
      }
      logger.info('forum', `Using persistent cookies for ${config.name}; skipping login.`);
      return true;
    }

    if (!config.credentials) {
      logger.warn('forum', `No credentials for ${config.name}; cannot perform login.`);
      return false;
    }

    try {
      logger.info('forum', `Attempting authentication for ${config.name}...`);

      // Use Playwright for sites protected by Cloudflare
      logger.info('forum', `[${config.name}] Trying Playwright/headless browser approach for Cloudflare...`);

      if (!this.cfHandler) {
        this.cfHandler = new CloudflareHandler();
      }

      const result = await this.cfHandler.loginToForum(
        config.baseUrl,
        '/login.php?do=login',
        config.credentials.username,
        config.credentials.password,
        process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL
      );

      if (result.success && result.cookies) {
        logger.info('forum', `✓ Successfully authenticated with ${config.name}`);
        // Set cookies in axios client
        client.defaults.headers.Cookie = result.cookies;
        if (result.userAgent) {
          client.defaults.headers['User-Agent'] = result.userAgent;
        }
        // Persist cookies to DB if cookie array present
        try {
          const cookiesJson = JSON.stringify({ cookies: result.cookieArray || [], userAgent: result.userAgent });
          await db.forum.update({
            where: { id: forumId },
            data: {
              persistentCookies: cookiesJson,
              cookiesUpdatedAt: new Date(),
            }
          });
          // Keep in-memory config aligned so fallback paths see fresh cookies/UA
          config.persistentCookies = cookiesJson;
          this.configs.set(forumId, { ...config });
          logger.info('forum', `Persistent cookies stored (${(result.cookieArray || []).length})`);
        } catch (err) {
          logger.error('forum', `Failed to store persistent cookies: ${err}`);
        }
        return true;
      }

      logger.warn('forum', `Authentication failed for ${config.name}: ${result.error}`);
      return false;

    } catch (error: any) {
      logger.error('forum', `Authentication error for ${config.name}: ${error.message}`);
      return false;
    }
  }

  // Search forum for content
  async searchForum(
    forumId: string,
    query: string,
    options?: { page?: number; fetchAll?: boolean; maxPages?: number; titleOnly?: boolean; searchId?: string }
  ): Promise<ForumSearchResponse> {
    const config = this.configs.get(forumId);
    const client = this.clients.get(forumId);

    if (!config || !client) {
      throw new Error(`Forum ${forumId} not configured`);
    }

    try {
      logger.info('search', `[${config.name}] searchMode=${config.searchMode || 'native'}, query="${query}"`);

      // NOTE: Google "site:" mode is currently considered unsupported/disabled.
      // Keep the implementation behind a feature flag to avoid breaking existing DB values,
      // but default to native search.
      if (config.searchMode === 'google_site') {
        if (process.env.ENABLE_GOOGLE_SITE_SEARCH !== 'true') {
          logger.warn('search', `[${config.name}] google_site mode is disabled; falling back to native search`);
        } else {
          const googleClient = axios.create({
            baseURL: 'https://www.google.com',
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            }
          });

          const gqBase = `site:${config.baseUrl.replace(/https?:\/\//, '')}`;
          const gqQuery = options?.titleOnly ? `intitle:${query}` : query;
          const gq = `${gqBase} ${gqQuery}`;
          logger.info('search', `Google site search query: ${gq}`);

          const res = await googleClient.get('/search', { params: { q: gq, hl: 'es', num: 50 } });
          logger.info('search', `Google response status: ${res.status}`);

          const $ = cheerio.load(res.data);
          const results: ForumSearchResult[] = [];

          // Google SERP parsing - search for result containers
          // Modern Google uses div[data-hveid] or divs with specific classes
          const forumHost = new URL(config.baseUrl).host;
          logger.info('search', `Looking for results from host: ${forumHost}`);

          // Try modern structure: div.g or div[data-sokoban-container]
          $('div.g, div[data-sokoban-container], div.Gx5Zad').each((idx, container) => {
            const $container = $(container);

            // Find the main link (usually first <a> with href)
            const $link = $container.find('a[href]').first();
            const href = $link.attr('href');
            if (!href) {
              logger.warn('search', `Container ${idx}: No href found`);
              return;
            }

            // Extract title from h3 or parent text
            let title = $link.find('h3').text().trim();
            if (!title) {
              title = $link.text().trim();
            }
            if (!title) {
              logger.warn('search', `Container ${idx}: No title found for href ${href}`);
              return;
            }

            let url = href;
            // Google often uses /url?q=<url>
            if (href.startsWith('/url?')) {
              try {
                const u = new URL('https://www.google.com' + href);
                const q = u.searchParams.get('q');
                if (q) url = q;
              } catch {
                logger.warn('search', `Container ${idx}: Failed to parse /url? format: ${href}`);
                return;
              }
            }

            // Validate URL belongs to forum
            try {
              const u = new URL(url);
              logger.info('search', `Container ${idx}: Checking URL ${url} (host: ${u.host})`);

              if (u.host.endsWith(forumHost) && url.includes('showthread')) {
                results.push({
                  title,
                  url,
                  forum: config.name,
                  hasLinks: false,
                  thankRequired: false,
                });
                logger.info('search', `Container ${idx}: ✓ Added result: ${title}`);
              } else {
                logger.info('search', `Container ${idx}: Skipped (host mismatch or not showthread): ${url}`);
              }
            } catch (err) {
              logger.warn('search', `Container ${idx}: Invalid URL: ${url}`, err);
            }
          });

          logger.info('search', `Google site search found ${results.length} results for "${query}"`);

          // De-duplicate by URL
          const unique = new Map<string, ForumSearchResult>();
          results.forEach(r => { if (!unique.has(r.url)) unique.set(r.url, r); });
          const finalResults = Array.from(unique.values());

          logger.info('search', `After deduplication: ${finalResults.length} unique results`);
          return { results: finalResults, totalResults: finalResults.length };
        }
      }

      // If using Google CSE (Custom Search Engine)
      if (config.searchMode === 'google_cse') {
        // If cseId is not set, try to use a fallback ID (can be overridden in DB)
        const cseId = config.cseId || process.env.NEXT_PUBLIC_CSE_ID || '44f04a516a5b84434';

        logger.info('search', `Google CSE mode with ID: ${cseId}`);

        const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;

        if (!flaresolverrUrl) {
          logger.error('search', 'Google CSE requires FlareSolverr to be configured');
          return { results: [] };
        }

        try {
          const buildCseUrl = (page?: number) => {
            // Google CSE is JS-driven and uses hash for pagination, not query params
            const base = `https://cse.google.com/cse?cx=${cseId}&q=${encodeURIComponent(query)}`;
            if (page && page > 1) {
              return `${base}#gsc.tab=0&gsc.q=${encodeURIComponent(query)}&gsc.page=${page}`;
            }
            return base;
          };

          const fetchPageHtml = async (page?: number) => {
            const url = buildCseUrl(page);
            logger.info('search', `Google CSE search URL: ${url}`);
            const FlareSolverrClientModule = await import('./flaresolverr-client');
            const cseClient = new FlareSolverrClientModule.FlareSolverrClient(flaresolverrUrl);
            const solution = await cseClient.request(url, 'GET');
            return solution.response || '';
          };

          const parseResultsFromHtml = (html: string) => {
            // Prefer structured parsing over regex to avoid duplicates across pages
            const out: ForumSearchResult[] = [];
            const forumHost = new URL(config.baseUrl).host;

            try {
              const $ = cheerio.load(html);
              // Google CSE renders results with these classes
              // Each result: div.gsc-result > a.gs-title (may have data-ctorig with original URL)
              const anchors = $('.gsc-results .gsc-result .gs-title a[href], .gsc-results .gsc-webResult .gs-title a[href]');

              if (anchors.length === 0) {
                // Fallback: some CSE templates use different containers
                const altAnchors = $('a.gs-title[href], a.gs-title[data-ctorig]');
                altAnchors.each((idx, el) => anchors.push(el));
              }

              let matchCount = 0;
              anchors.each((idx, el) => {
                const $a = $(el);
                const href = ($a.attr('data-ctorig') || $a.attr('href') || '').trim();
                const titleRaw = ($a.text() || '').replace(/\s+/g, ' ').trim();
                if (!href) return;

                matchCount++;
                try {
                  let absoluteUrl = href;
                  if (href.startsWith('/')) {
                    absoluteUrl = config.baseUrl + href;
                  } else if (!/^https?:\/\//i.test(href)) {
                    absoluteUrl = config.baseUrl.replace(/\/$/, '') + '/' + href.replace(/^\//, '');
                  }
                  const u = new URL(absoluteUrl);
                  logger.info('search', `CSE Match ${matchCount}: Checking URL ${absoluteUrl} (host: ${u.host})`);

                  if (u.host.endsWith(forumHost) && /showthread/i.test(absoluteUrl)) {
                    out.push({
                      title: titleRaw || absoluteUrl,
                      url: absoluteUrl,
                      forum: config.name,
                      hasLinks: false,
                      thankRequired: false,
                    });
                  }
                } catch (e) {
                  // ignore malformed URLs
                }
              });

              logger.info('search', `CSE parsed ${matchCount} links, ${out.length} valid`);
            } catch (err) {
              logger.warn('search', `CSE cheerio parse failed, falling back to regex: ${err instanceof Error ? err.message : String(err)}`);

              // Fallback regex in case cheerio fails (rare)
              const showthreadRe = /<a[^>]*href=["']([^"']*showthread[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
              let match: RegExpExecArray | null;
              let matchCount = 0;
              while ((match = showthreadRe.exec(html)) !== null) {
                matchCount++;
                const url = match[1];
                const titleRaw = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (titleRaw && url) {
                  try {
                    let absoluteUrl = url;
                    if (url.startsWith('/')) {
                      absoluteUrl = config.baseUrl + url;
                    } else if (!url.startsWith('http')) {
                      absoluteUrl = config.baseUrl + '/' + url;
                    }
                    const u = new URL(absoluteUrl);
                    logger.info('search', `CSE Match ${matchCount}: Checking URL ${absoluteUrl} (host: ${u.host})`);
                    if (u.host.endsWith(forumHost)) {
                      out.push({
                        title: titleRaw,
                        url: absoluteUrl,
                        forum: config.name,
                        hasLinks: false,
                        thankRequired: false,
                      });
                    }
                  } catch {
                    // ignore
                  }
                }
              }
              logger.info('search', `CSE (fallback) parsed ${matchCount} links, ${out.length} valid`);
            }

            return out;
          };

          const deDup = (arr: ForumSearchResult[]) => {
            const unique = new Map<string, ForumSearchResult>();
            arr.forEach(r => { if (!unique.has(r.url)) unique.set(r.url, r); });
            return Array.from(unique.values());
          };

          let results: ForumSearchResult[] = [];

          // fetchAll mode: iterate pages until no new results or maxPages reached
          if (options?.fetchAll) {
            const maxPages = Math.max(1, options.maxPages ?? 5);
            let page = 1;
            let lastTotal = 0;
            while (page <= maxPages) {
              const html = await fetchPageHtml(page);
              if (!html) {
                logger.warn('search', `Google CSE empty response at page ${page}`);
                break;
              }
              const pageResults = parseResultsFromHtml(html);
              const before = results.length;
              results = deDup([...results, ...pageResults]);
              const after = results.length;
              logger.info('search', `CSE page ${page}: +${after - before} new (total unique: ${after})`);
              // stop if no growth in unique results
              if (after <= lastTotal) break;
              lastTotal = after;
              page++;
            }
            return { results: results };
          }

          // single page mode (specific page or first page)
          const page = options?.page && options.page > 1 ? options.page : 1;
          const html = await fetchPageHtml(page);
          if (!html) {
            logger.warn('search', 'Google CSE returned empty response');
            return { results: [] };
          }

          logger.info('search', `Google CSE HTML length: ${html.length}`);
          const pageResults = parseResultsFromHtml(html);
          return { results: deDup(pageResults) };



        } catch (error) {
          logger.error('search', `Google CSE search error: ${error instanceof Error ? error.message : String(error)}`);
          if (error instanceof Error && error.stack) {
            logger.error('search', `Stack: ${error.stack.substring(0, 200)}`);
          }
          return { results: [] };
        }
      }

      // Native search for vBulletin-style forums (descargasdd search.php)
      // IMPORTANT: run as authenticated user when credentials are configured.
      // Axios client already carries persistent cookies from the authentication step.
      const resolvedTitleOnly = options?.titleOnly ?? (config.searchMode === 'native' ? (config.searchTitleOnly ?? true) : false);
      const resolvedChildForums = config.searchInChildForums ?? true;
      const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;

      const joinUrl = (base: string, path: string) => {
        const baseTrimmed = (base || '').replace(/\/$/, '');
        const pathTrimmed = (path || '').trim();
        if (!pathTrimmed) return baseTrimmed;
        if (/^https?:\/\//i.test(pathTrimmed)) return pathTrimmed;
        if (pathTrimmed.startsWith('/')) return `${baseTrimmed}${pathTrimmed}`;
        return `${baseTrimmed}/${pathTrimmed}`;
      };

      const extractSearchResultsUrl = (input: string) => {
        if (!input) return '';
        // Try several patterns to capture search results URL
        const patterns = [
          /search\.php\?[^\s"'>]*searchid=\d+[^\s"'>]*/i, // direct link with searchid
          /url=([^"'>]*search\.php[^"'>]*searchid=\d+[^"'>]*)/i, // meta refresh content="...url=search.php?searchid=..."
          /location\.(?:href|replace)\s*=\s*['"]([^'"\s]*search\.php[^'"\s]*searchid=\d+[^'"\s]*)['"]/i, // JS redirect
          /href=['"]([^'"\s]*search\.php[^'"\s]*searchid=\d+[^'"\s]*)['"]/i, // anchor fallback
        ];
        for (const re of patterns) {
          const m = input.match(re);
          if (m && m[1]) return m[1];
          if (m && m[0]) return m[0];
        }
        return '';
      };

      const extractSearchIdValue = (input: string) => {
        if (!input) return '';
        // 1) Hidden input
        const hidden = input.match(/name=["']searchid["'][^>]*value=["'](\d+)["']/i);
        if (hidden?.[1]) return hidden[1];

        // 2) Query string anywhere in the document
        const qs = input.match(/\bsearchid=(\d+)\b/i);
        if (qs?.[1]) return qs[1];

        // 3) JavaScript assignment (vBulletin sometimes builds redirect URL dynamically)
        const jsAssign = input.match(/\bsearchid\b\s*(?:=|:)\s*["']?(\d+)["']?/i);
        if (jsAssign?.[1]) return jsAssign[1];

        // 4) Fallback: searchid value inside JSON-ish blobs
        const jsonish = input.match(/["']searchid["']\s*:\s*(\d+)/i);
        return jsonish?.[1] || '';
      };

      const safeSnippet = (html: string, maxLen = 2500) => {
        if (!html) return '';
        const clipped = html.length > maxLen ? `${html.slice(0, maxLen)}\n...<clipped>...` : html;
        // Avoid writing potential tokens/credentials to disk.
        return clipped
          .replace(/(password\s*["']?\s*[:=]\s*["']).*?(["'])/gi, '$1<redacted>$2')
          .replace(/(securitytoken\s*["']?\s*value=["']).*?(["'])/gi, '$1<redacted>$2')
          .replace(/(token\s*["']?\s*value=["']).*?(["'])/gi, '$1<redacted>$2');
      };

      const redactPostDataForLog = (data: Record<string, string>) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(data)) {
          const key = k.toLowerCase();
          if (key.includes('pass') || key.includes('password')) {
            out[k] = '<redacted>';
            continue;
          }
          if (key.includes('token')) {
            out[k] = v ? '<redacted>' : '';
            continue;
          }
          out[k] = typeof v === 'string' && v.length > 120 ? `${v.slice(0, 120)}...` : v;
        }
        return out;
      };

      const ensureAbsoluteSearchUrl = (maybeRelative: string) => {
        if (!maybeRelative) return '';
        if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
        if (maybeRelative.startsWith('/')) return joinUrl(config.baseUrl, maybeRelative);
        // If the match starts at search.php?... (no leading slash)
        return joinUrl(config.baseUrl, `/${maybeRelative}`);
      };

      const getAbs = (href: string) => {
        if (!href) return href;
        if (/^https?:\/\//i.test(href)) return href;
        if (href.startsWith('/')) return `${config.baseUrl}${href}`;
        return `${config.baseUrl.replace(/\/$/, '')}/${href}`;
      };

      const getAxiosDefaultHeader = (name: string): string | undefined => {
        const h = client.defaults.headers as any;
        // axios can keep defaults in different buckets
        return (
          h?.[name] ||
          h?.[name.toLowerCase()] ||
          h?.common?.[name] ||
          h?.common?.[name.toLowerCase()] ||
          h?.post?.[name] ||
          h?.post?.[name.toLowerCase()] ||
          h?.get?.[name] ||
          h?.get?.[name.toLowerCase()]
        );
      };

      const pickSearchForm = ($doc: cheerio.CheerioAPI) => {
        const forms = $doc('form');
        let best: { score: number; form: cheerio.Cheerio<cheerio.Element> } | null = null;

        forms.each((_, el) => {
          const $f = $doc(el);
          const actionRaw = ($f.attr('action') || '').trim();
          const actionAbs = getAbs(actionRaw || '');
          const hasQuery = $f.find('input[name="query"], input[name="keywords"], input[name="dosearch"]').length > 0;
          const hasSecurityToken = $f.find('input[name="securitytoken"]').length > 0;
          const hasLoginFields = $f.find('input[name^="vb_login"], input[name="vb_login_username"], input[name="vb_login_password"]').length > 0;
          const doVal = ($f.find('input[name="do"]').attr('value') || '').toLowerCase();

          const forumFieldCount = $f
            .find('select, input[type="checkbox"], input[type="radio"]')
            .filter((_, node) => {
              const $node = $doc(node);
              const name = ($node.attr('name') || '').toLowerCase();
              const id = ($node.attr('id') || '').toLowerCase();
              return name.includes('forum') || name.includes('cat') || id.includes('forum') || id.includes('cat');
            })
            .length;
          const multiSelectCount = $f.find('select[multiple], select[size]')
            .filter((_, node) => {
              const $node = $doc(node);
              const name = ($node.attr('name') || '').toLowerCase();
              const id = ($node.attr('id') || '').toLowerCase();
              return name.includes('forum') || id.includes('forum');
            })
            .length;

          let score = 0;
          if (actionAbs && /\/search\.php/i.test(actionAbs)) score += 5;
          if (hasQuery) score += 3;
          if (hasSecurityToken) score += 1;
          if (doVal === 'process') score += 2;
          if (forumFieldCount > 0) score += 4 + forumFieldCount;
          if (multiSelectCount > 0) score += 3 + multiSelectCount;
          if (config.searchForumLabel && forumFieldCount > 0) score += 3;
          if (hasLoginFields) score -= 10;

          if (!best || score > best.score) best = { score, form: $f };
        });

        if (!best || best.score <= 0) return null;
        return best.form;
      };

      let forumFilterApplied = false;

      const parseResults = (html: string) => {
        const $ = cheerio.load(html || '');
        const out: ForumSearchResult[] = [];
        const seen = new Set<string>();

        const extractThreadId = (href: string): string | null => {
          if (!href) return null;
          const patterns: RegExp[] = [
            /showthread\.php\?(?:t=)?(\d+)/i, // showthread.php?t=123
            /showthread\.php\?threadid=(\d+)/i, // showthread.php?threadid=123
            /showthread\.php\?(\d+)/i, // showthread.php?123-title
            /[?&](?:t|threadid)=(\d+)/i, // ...?t=123 or ...&threadid=123
            /\/threads\/(\d+)(?:[-/]|$)/i, // /threads/123-title
            /\/thread\/(\d+)(?:[-/]|$)/i, // /thread/123-title
            /\/threads\/[^/]*[.-](\d+)(?:\/|$)/i, // /threads/title.123/
            /\/thread\/[^/]*[.-](\d+)(?:\/|$)/i, // /thread/title.123/
          ];

          for (const re of patterns) {
            const m = href.match(re);
            if (m?.[1]) return m[1];
          }
          return null;
        };

        const selectors = [
          'a[id^="thread_title"]',
          'a.threadtitle',
          'h3.searchtitle a',
          'h3 a.threadtitle',
          'a[href*="showthread.php?t="]',
          'a[href*="showthread.php?threadid="]',
          'a[href*="/threads/"]',
          'a[href*="threads/"]',
        ];

        const addResult = ($a: cheerio.Cheerio<cheerio.Element>) => {
          const href = getAbs($a.attr('href') || '');
          if (!href || seen.has(href)) return;

          // Keep it permissive but still require a numeric thread id.
          const threadId = extractThreadId(href);
          if (!threadId) return;
          const title = ($a.text() || '').replace(/\s+/g, ' ').trim();
          if (!title || title.length < 3) return;

          // Drop banners/avisos/donaciones
          if (/donaciones|aviso del foro|aviso del for/i.test(title)) return;

          const row = $a.closest('tr, li, div');
          const snippet = (row.find('.excerpt, .post_preview, .postpreview').first().text() || '')
            .replace(/\s+/g, ' ')
            .trim();

          let forumText = '';
          let dateText = '';
          const rowText = row.text();
          const forumMatch = rowText.match(/Foros:\s*([^\n]+)/i);
          if (forumMatch) forumText = forumMatch[1].trim();
          const lastMatch = rowText.match(/Último mensaje:\s*([^\n]+)/i);
          if (lastMatch) dateText = lastMatch[1].trim();

          const sizeStr = extractSize(title) || (snippet ? extractSize(snippet) : null);
          const sizeBytes = sizeStr ? convertSizeToBytes(sizeStr) : undefined;
          
          out.push({
            title,
            url: href,
            forum: forumText || config.name,
            date: dateText,
            hasLinks: false,
            thankRequired: false,
            snippet: snippet || undefined,
            size: sizeBytes,
          });
          seen.add(href);
        };

        selectors.forEach((sel) => {
          $(sel).each((_, el) => addResult($(el)));
        });

        // Fallback: scan all anchors (some forums change markup/classes frequently).
        if (out.length === 0) {
          $('a[href]').each((_, el) => addResult($(el)));
        }

        return out;
      };

      const extractTotalResults = (html: string): number | undefined => {
        if (!html) return undefined;
        const $ = cheerio.load(html);

        // Look for total results count in various formats
        const text = $.text() || '';

        // Try different patterns
        const patterns = [
          /Results?\s+\d+\s*-\s*\d+\s+of\s+(\d+)/i,  // English: Results 1 - 25 of 30
          /Resultados?\s+\d+\s*(?:-|a|al)\s*\d+\s+de\s+(\d+)/i,  // Spanish: Resultados 1 al 25 de 30 (supports '-', 'a', 'al')
          /Mostrando\s+resultados?\s+(?:del\s+)?\d+\s*(?:-|a|al)\s*\d+\s+de\s+(\d+)/i, // Spanish: Mostrando resultados del 1 al 25 de 30
          /Mostrando\s+(?:mensajes|resultados)[^\d]*(\d+)[^\d]*(\d+)[^\d]*de\s+(\d+)/i, // Spanish variant with words in between
          /of\s+(\d+)\s+results?/i,  // of 30 results
          /de\s+(\d+)\s+resultados?/i,  // de 30 resultados
          /\(\d+\s+de\s+(\d+)\)/i,  // (25 de 30)
          /total\s*[:\s]+(\d+)/i,  // total: 30
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          // Some patterns may capture multiple groups; prefer the last numeric group
          const group = match ? match[match.length - 1] : undefined;
          if (group) {
            const total = parseInt(group, 10);
            if (!isNaN(total) && total > 0) {
              logger.info('search', `[${config.name}] Extracted totalResults: ${total} (pattern: ${pattern})`);
              return total;
            }
          }
        }

        // Try to find in page navigation or info elements
        const navText = $('div.pagenav, div.pagination, .paging, nav, .pageinfo').text() || '';
        for (const pattern of patterns) {
          const match = navText.match(pattern);
          if (match?.[1]) {
            const total = parseInt(match[1], 10);
            if (!isNaN(total) && total > 0) {
              logger.info('search', `[${config.name}] Extracted totalResults from nav: ${total}`);
              return total;
            }
          }
        }

        logger.warn('search', `[${config.name}] Could not extract totalResults from HTML`);
        return undefined;
      };

      const filterResults = (list: ForumSearchResult[]) => {
        let filtered = list;
        if (config.searchForumLabel && !forumFilterApplied) {
          const label = config.searchForumLabel.toLowerCase();
          filtered = filtered.filter(r => (r.forum || '').toLowerCase().includes(label));
        }
        return filtered;
      };

      const selectForumByLabel = (
        $doc: cheerio.CheerioAPI,
        $form: cheerio.Cheerio<cheerio.Element>,
        postData: Record<string, string>
      ) => {
        if (!config.searchForumLabel) return;
        logger.info('search', `[${config.name}] Using searchForumLabel: ${config.searchForumLabel}`);
        const normalize = (text: string) =>
          (text || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .trim();

        const label = normalize(config.searchForumLabel);

        // Prefer selects that look like forum/category filters
        const selects = $form.find('select[name]');
        // Some forums use checkbox/radio lists like forumchoice[]
        const forumInputs = $form.find('input[type="checkbox"], input[type="radio"]');

        const isForumFieldName = (name: string) => {
          const lower = name.toLowerCase();
          return lower.includes('forum') || lower.includes('cat') || lower.includes('search');
        };

        let applied = false;

        const tryApply = (name: string, value: string) => {
          if (!name || !value || applied) return;
          postData[name] = value;
          logger.info('search', `[${config.name}] Selected forum field ${name}: ${value}`);
          applied = true;
        };

        selects.each((_, sel) => {
          if (applied) return;
          const $sel = $doc(sel);
          const selName = ($sel.attr('name') || '').trim();
          const selId = ($sel.attr('id') || '').trim();
          if (!selName || (!isForumFieldName(selName) && !isForumFieldName(selId))) return;

          let foundValue: string | null = null;
          $sel.find('option').each((_, opt) => {
            const $opt = $doc(opt);
            const optText = ($opt.text() || '').replace(/\s+/g, ' ').trim();
            const optValue = ($opt.attr('value') || '').trim();
            if (!optText && !optValue) return;
            const matchText = normalize(optText);
            const matchValue = normalize(optValue);
            if (matchText.includes(label) || matchValue.includes(label)) {
              // vBulletin expects a real option value (usually a numeric forum id).
              // Do NOT send the display label as the value because the server will ignore it.
              if (optValue) foundValue = optValue;
            }
          });

          if (foundValue) {
            tryApply(selName, foundValue);
            postData['childforums'] = postData['childforums'] || (resolvedChildForums ? '1' : '0');
            forumFilterApplied = true;
          }
        });

        // Fallback: checkbox/radio forum selectors (common in search.php?search_type=1)
        forumInputs.each((_, el) => {
          if (applied) return;
          const $el = $doc(el);
          const name = ($el.attr('name') || '').trim();
          if (!name || !isForumFieldName(name)) return;
          const value = ($el.attr('value') || '').trim();
          if (!value) return;

          // Try to read the text next to the input (same parent or label)
          let text = '';
          const parentText = $el.parent().text();
          if (parentText) text = parentText.replace(/\s+/g, ' ').trim();
          if (!text && $el.next().length) {
            text = $el.next().text().replace(/\s+/g, ' ').trim();
          }
          if (!text && $el.prev().length) {
            text = $el.prev().text().replace(/\s+/g, ' ').trim();
          }

          if (normalize(text).includes(label) || normalize(value).includes(label)) {
            tryApply(name, value);
            postData['childforums'] = postData['childforums'] || (resolvedChildForums ? '1' : '0');
            forumFilterApplied = true;
          }
        });

        if (!applied) {
          const selectNames = selects
            .map((_, el) => ($doc(el).attr('name') || '').trim())
            .get()
            .filter(Boolean);
          const inputNames = forumInputs
            .map((_, el) => ($doc(el).attr('name') || '').trim())
            .get()
            .filter(Boolean);
          logger.warn('search', `[${config.name}] searchForumLabel configured but no matching forum field found`, {
            label: config.searchForumLabel,
            selectNames,
            inputNames,
          });
        }
      };

      const buildPostDataFromForm = (
        $doc: cheerio.CheerioAPI,
        $form: cheerio.Cheerio<cheerio.Element>
      ) => {
        const postData: Record<string, string> = {};
        $form.find('input, select, textarea').each((_, el) => {
          const $el = $doc(el);
          const name = ($el.attr('name') || '').trim();
          if (!name) return;

          const type = ($el.attr('type') || '').toLowerCase();
          // Skip submit/button/image controls unless it is the actual search submit (dosearch)
          if (type === 'submit' || type === 'button' || type === 'image') {
            if (name !== 'dosearch') return;
          }

          if ($el.is('input[type="radio"], input[type="checkbox"]')) {
            const checked = !!$el.attr('checked');
            if (!checked) return;
          }

          const raw = $el.val();
          const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
          postData[name] = String(value);
        });

        postData['query'] = query;
        postData['keywords'] = query;
        postData['showresults'] = postData['showresults'] || 'threads';
        // Respect forum-level preference for including child forums
        const childForumsValue = resolvedChildForums ? '1' : '0';
        postData['childforums'] = postData['childforums'] ?? childForumsValue;
        postData['do'] = postData['do'] || 'process';
        postData['search_type'] = postData['search_type'] || '1';

        // vBulletin expects forumchoice[] to be numeric ids (or 0 for all forums).
        // Some pages can expose forum labels as values; that breaks do=process and no searchid is generated.
        // If we detect a non-numeric forumchoice[] value, drop it (fallback to searching all forums).
        const forumChoiceKeys = Object.keys(postData).filter((k) => k.toLowerCase().includes('forumchoice'));
        for (const key of forumChoiceKeys) {
          const raw = (postData[key] || '').trim();
          if (!raw) continue;
          // Allow numeric ids or "0".
          if (/^\d+$/.test(raw) || raw === '0') {
            postData[key] = raw;
            continue;
          }
          logger.warn('search', `[${config.name}] Dropping invalid forumchoice value (expected numeric id). Falling back to all forums.`, {
            key,
            value: postData[key],
            searchForumLabel: config.searchForumLabel || null,
          });
          delete postData[key];
        }

        return postData;
      };

      const resolveResultsUrl = (finalUrl: string, html: string) => {
        const urlFromFinal = ensureAbsoluteSearchUrl(extractSearchResultsUrl(finalUrl || ''));
        const urlFromBody = ensureAbsoluteSearchUrl(extractSearchResultsUrl(html || ''));
        const searchIdFromBody = extractSearchIdValue(html || '');
        const urlFromHiddenSearchId = searchIdFromBody
          ? ensureAbsoluteSearchUrl(`search.php?searchid=${searchIdFromBody}`)
          : '';
        return {
          resultUrl: urlFromFinal || urlFromBody || urlFromHiddenSearchId,
          urlFromFinal,
          urlFromBody,
          searchIdFromBody: searchIdFromBody || null,
        };
      };

      const isGuestHtml = (html: string) => {
        const h = html || '';
        return /SECURITYTOKEN\s*=\s*"guest"/i.test(h) || /LOGGEDIN\s*=\s*0\s*>\s*0\s*\?/i.test(h) || /LOGGEDIN\s*=\s*0\b/i.test(h);
      };

      // 1) Primary path: axios with authenticated cookies

      // If searchId is provided (pagination), skip form submission and go directly to results pages
      if (options?.searchId) {
        const pageNum = options.page || 1;
        const baseSearchUrl = joinUrl(config.baseUrl, `/search.php?searchid=${options.searchId}`);
        logger.info('search', `[${config.name}] Using existing searchid for pagination: ${options.searchId}, page ${pageNum}`);

        try {
          if (options?.fetchAll) {
            const maxPages = Math.max(1, options.maxPages ?? 10);
            const aggregated: ForumSearchResult[] = [];
            const seen = new Set<string>();
            let firstHtml = '';
            for (let p = 1; p <= maxPages; p++) {
              const pageParam = `&page=${p}`;
              const url = `${baseSearchUrl}${pageParam}`;
              const resp = await client.get(url);
              const html = String(resp.data || '');
              if (!firstHtml) firstHtml = html;
              const pageResults = parseResults(html);
              let added = 0;
              for (const r of pageResults) {
                if (r.url && !seen.has(r.url)) {
                  aggregated.push(r);
                  seen.add(r.url);
                  added++;
                }
              }
              const totalResults = extractTotalResults(firstHtml);
              if (totalResults && aggregated.length >= totalResults) break;
              if (added === 0) break;
            }
            const totalResults = extractTotalResults(firstHtml);
            return { results: aggregated, searchId: options.searchId, totalResults };
          } else {
            const searchUrl = `${baseSearchUrl}&page=${pageNum}`;
            const resultsResp = await client.get(searchUrl);
            const pageResults = parseResults(String(resultsResp.data || ''));
            const totalResults = extractTotalResults(String(resultsResp.data || ''));
            return { results: pageResults, searchId: options.searchId, totalResults };
          }
        } catch (err) {
          logger.warn('search', `[${config.name}] Axios pagination failed with searchid ${options.searchId}, will try FlareSolverr`, {
            error: err instanceof Error ? err.message : String(err),
          });
          // Fall through to FlareSolverr path below
        }
      }

      // Normal first search (no searchId yet)
      if (!options?.searchId) {
        try {
          const firstPageUrl = joinUrl(config.baseUrl, config.searchPath);
          const firstPage = await client.get(firstPageUrl);
          const $formDoc = cheerio.load(String(firstPage.data || ''));

          const form = pickSearchForm($formDoc);

          if (!form || form.length === 0) {
            logger.warn('search', `[${config.name}] Native search form not found via axios at ${firstPageUrl}`);
            throw new Error('Native search form not found via axios');
          }

          let action = form.attr('action') || firstPageUrl;
          action = getAbs(action);

          if (!/\/search\.php/i.test(action)) {
            logger.warn('search', `[${config.name}] Picked non-search form via axios; refusing to POST`, {
              action,
            });
            throw new Error('Picked non-search form via axios');
          }

          const postData = buildPostDataFromForm($formDoc, form);
          // Apply titleOnly filter when present
          if (resolvedTitleOnly) {
            postData['titleonly'] = '1';
          } else {
            // Ensure explicit 0 to avoid inherited defaults
            postData['titleonly'] = '0';
          }
          selectForumByLabel($formDoc, form, postData);

          const payload = new URLSearchParams(postData).toString();
          const resp = await client.post(action, payload, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: firstPageUrl,
            },
          });

          const html = String(resp.data || '');
          const finalUrl = (resp as any)?.request?.res?.responseUrl || action;

          if (isGuestHtml(html)) {
            logger.warn('search', `[${config.name}] Native search response looks like guest (cookies not applied).`);
          }

          const { resultUrl, urlFromFinal, urlFromBody, searchIdFromBody } = resolveResultsUrl(finalUrl, html);

          if (!resultUrl) {
            const directResults = parseResults(html);
            if (directResults.length > 0) {
              logger.info('search', `[${config.name}] Native search returned results directly via axios (no searchid).`);
              const totalResults = extractTotalResults(html);
              return { results: directResults, searchId: searchIdFromBody || undefined, totalResults };
            }

            const totalResultsHint = extractTotalResults(html);
            if (totalResultsHint && totalResultsHint > 0) {
              const $d = cheerio.load(html || '');
              const hrefSamples = $d('a[href]')
                .map((_, el) => String($d(el).attr('href') || '').trim())
                .get()
                .filter(Boolean)
                .filter(h => /(showthread\.php|\/threads\/|threadid=|[?&]t=)/i.test(h))
                .slice(0, 20);
              logger.warn('search', `[${config.name}] totalResults>0 but parsed 0 results via axios; href samples`, {
                totalResults: totalResultsHint,
                sampleCount: hrefSamples.length,
                hrefSamples,
              });
            }

            logger.warn('search', `[${config.name}] Could not extract search results URL (searchid) via axios`);
            logger.info('search', `[${config.name}] Native search debug (POST/axios)`, {
              firstPageUrl,
              action,
              processedFinalUrl: finalUrl,
              responseLength: html.length,
              extractedSearchId: searchIdFromBody,
              extractedUrlFromFinal: urlFromFinal || null,
              extractedUrlFromBody: urlFromBody || null,
              postDataKeys: Object.keys(postData),
              postDataPreview: redactPostDataForLog(postData),
            });
            logger.info('search', `[${config.name}] Native search debug HTML snippet (POST/axios)`, safeSnippet(html));

            // Fall through to FlareSolverr fallback if available.
          } else {
            // Pagination: single page or fetchAll
            if (options?.fetchAll) {
              const maxPages = Math.max(1, options.maxPages ?? 10);
              const aggregated: ForumSearchResult[] = [];
              const seen = new Set<string>();
              const totalResults = extractTotalResults(html);

              for (let p = 1; p <= maxPages; p++) {
                const pageParam = p > 1 ? `&page=${p}` : '';
                const resultsPageResp = await client.get(`${resultUrl}${pageParam}`);
                const pageResults = parseResults(String(resultsPageResp.data || ''));
                let added = 0;
                for (const r of pageResults) {
                  if (r.url && !seen.has(r.url)) {
                    aggregated.push(r);
                    seen.add(r.url);
                    added++;
                  }
                }
                // Stop if we've collected all available results or no new results
                if (totalResults && aggregated.length >= totalResults) break;
                if (added === 0) break;
              }
              return { results: aggregated, searchId: searchIdFromBody || undefined, totalResults };
            }

            const pageParam = options?.page && options.page > 1 ? `&page=${options.page}` : '';
            const resultsPageResp = await client.get(`${resultUrl}${pageParam}`);
            const pageResults = parseResults(String(resultsPageResp.data || ''));
            const totalResults = extractTotalResults(String(resultsPageResp.data || ''));
            return { results: pageResults, searchId: searchIdFromBody || undefined, totalResults };
          }
        } catch (err) {
          logger.warn('search', `[${config.name}] Axios native search attempt failed, will try FlareSolverr fallback`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } // End of normal first search try block

      // 2) Fallback path: FlareSolverr with injected Cookie/User-Agent headers
      if (!flaresolverrUrl) {
        logger.warn('search', `[${config.name}] FlareSolverr not configured; cannot fallback for native search`);
        return { results: [] };
      }

      const FlareSolverrClientModule = await import('./flaresolverr-client');
      const fsClient = new FlareSolverrClientModule.FlareSolverrClient(flaresolverrUrl);
      // Note: We do NOT create a session here because FlareSolverr sessions manage their own cookies.
      // Instead, we pass custom headers directly to each request to inject our authenticated cookies.
      try {

        // Prefer persisted cookies from config (most reliable), then axios defaults
        const { cookies: storedCookies, userAgent: storedUserAgent } = this.parseStoredCookies(config.persistentCookies);
        let cookiesForFs = storedCookies;
        if (cookiesForFs.length === 0 && client?.defaults?.headers?.Cookie) {
          cookiesForFs = this.parseCookieHeader(client.defaults.headers.Cookie as any);
        }

        const userAgentHeader = storedUserAgent || getAxiosDefaultHeader('User-Agent') || (client?.defaults?.headers?.['User-Agent'] as string | undefined);

        logger.info('search', `[${config.name}] FlareSolverr fallback cookie/UA injection`, {
          storedCookiesCount: cookiesForFs.length,
          storedCookieNames: cookiesForFs.map(c => c.name),
          hasUserAgent: !!userAgentHeader,
        });

        const headers: Record<string, string> = {
          'Accept-Language': 'es-ES,es;q=0.9',
        };
        if (typeof userAgentHeader === 'string' && userAgentHeader.trim()) headers['User-Agent'] = userAgentHeader;

        logger.info('search', `[${config.name}] FlareSolverr fallback: passing ${cookiesForFs.length} cookies directly to FlareSolverr API`);

        const fsOptions = { maxTimeout: 15000, requestTimeout: 20000 };

        // If searchId is provided (pagination), skip form submission and go directly to results pages
        if (options?.searchId) {
          const baseSearchUrl = joinUrl(config.baseUrl, `/search.php?searchid=${options.searchId}`);
          const pageNum = options.page || 1;
          logger.info('search', `[${config.name}] FlareSolverr: Using existing searchid for pagination: ${options.searchId}, page ${pageNum}`);

          if (options?.fetchAll) {
            const maxPages = Math.max(1, options.maxPages ?? 10);
            const aggregated: ForumSearchResult[] = [];
            const seen = new Set<string>();
            let firstHtml = '';
            for (let p = 1; p <= maxPages; p++) {
              const pageUrl = `${baseSearchUrl}&page=${p}`;
              const resultsPage = await fsClient.request(pageUrl, 'GET', undefined, undefined, headers, cookiesForFs, fsOptions);
              const html = resultsPage.response || '';
              if (!firstHtml) firstHtml = html;
              const pageResults = parseResults(html);
              let added = 0;
              for (const r of pageResults) {
                if (r.url && !seen.has(r.url)) {
                  aggregated.push(r);
                  seen.add(r.url);
                  added++;
                }
              }
              const totalResults = extractTotalResults(firstHtml);
              if (totalResults && aggregated.length >= totalResults) break;
              if (added === 0) break;
            }
            const totalResults = extractTotalResults(firstHtml);
            return { results: aggregated, searchId: options.searchId, totalResults };
          } else {
            const searchUrl = `${baseSearchUrl}&page=${pageNum}`;
            const resultsPage = await fsClient.request(searchUrl, 'GET', undefined, undefined, headers, cookiesForFs, fsOptions);
            const pageResults = parseResults(resultsPage.response || '');
            const totalResults = extractTotalResults(resultsPage.response || '');
            return { results: pageResults, searchId: options.searchId, totalResults };
          }
        }

        const firstPageUrl = joinUrl(config.baseUrl, config.searchPath);
        // Ensure cookies carry domain/path for FlareSolverr
        const cookieDomain = new URL(config.baseUrl).host;
        const fsCookies = cookiesForFs.map(c => ({ name: c.name, value: c.value, domain: cookieDomain, path: '/' }));
        // Pass cookies as array to FlareSolverr (NOT as Cookie header - that doesn't work)
        const firstPage = await fsClient.request(firstPageUrl, 'GET', undefined, undefined, headers, fsCookies, fsOptions);
        const $formDoc = cheerio.load(firstPage.response || '');

        const form = pickSearchForm($formDoc);

        if (!form || form.length === 0) {
          logger.warn('search', `[${config.name}] Native search form not found via FlareSolverr at ${firstPageUrl}`);
          return { results: [] };
        }

        let action = form.attr('action') || firstPageUrl;
        action = getAbs(action);

        if (!/\/search\.php/i.test(action)) {
          logger.warn('search', `[${config.name}] Picked non-search form via FlareSolverr; refusing to POST`, {
            action,
          });
          logger.info('search', `[${config.name}] Debug HTML snippet (GET/FlareSolverr)`, safeSnippet(firstPage.response || ''));
          return { results: [] };
        }

        const postData = buildPostDataFromForm($formDoc, form);
        // Apply titleOnly filter when present
        if (options?.titleOnly) {
          postData['titleonly'] = '1';
        } else {
          postData['titleonly'] = '0';
        }
        selectForumByLabel($formDoc, form, postData);

        const postHeaders = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };

        const processed = await fsClient.request(action, 'POST', postData, undefined, postHeaders, fsCookies, fsOptions);

        const html = processed.response || '';
        const finalUrl = processed.url || action;
        const { resultUrl, urlFromFinal, urlFromBody, searchIdFromBody } = resolveResultsUrl(finalUrl, html);

        if (!resultUrl) {
          const directResults = parseResults(html);
          if (directResults.length > 0) {
            logger.info('search', `[${config.name}] Native search returned results directly via FlareSolverr (no searchid).`);
            const totalResults = extractTotalResults(html);
            return { results: directResults, searchId: searchIdFromBody || undefined, totalResults };
          }

          const totalResultsHint = extractTotalResults(html);
          if (totalResultsHint && totalResultsHint > 0) {
            const $d = cheerio.load(html || '');
            const hrefSamples = $d('a[href]')
              .map((_, el) => String($d(el).attr('href') || '').trim())
              .get()
              .filter(Boolean)
              .filter(h => /(showthread\.php|\/threads\/|threadid=|[?&]t=)/i.test(h))
              .slice(0, 20);
            logger.warn('search', `[${config.name}] totalResults>0 but parsed 0 results via FlareSolverr; href samples`, {
              totalResults: totalResultsHint,
              sampleCount: hrefSamples.length,
              hrefSamples,
            });
          }

          logger.warn('search', `[${config.name}] Could not extract search results URL (searchid) via FlareSolverr`);
          logger.info('search', `[${config.name}] Native search debug (POST/FlareSolverr)`, {
            firstPageUrl,
            action,
            processedFinalUrl: finalUrl,
            responseLength: html.length,
            extractedSearchId: searchIdFromBody,
            extractedUrlFromFinal: urlFromFinal || null,
            extractedUrlFromBody: urlFromBody || null,
            postDataKeys: Object.keys(postData),
            postDataPreview: redactPostDataForLog(postData),
          });
          logger.info('search', `[${config.name}] Native search debug HTML snippet (POST/FlareSolverr)`, safeSnippet(html));
          // Fallback attempt: try GET with querystring (some vBulletin installs accept GET for search processing)
          try {
            const qs = new URLSearchParams(postData).toString();
            const getUrl = `${action}${action.includes('?') ? '&' : '?'}${qs}`;
            const processedGet = await fsClient.request(getUrl, 'GET', undefined, undefined, postHeaders, fsCookies, fsOptions);
            const htmlGet = processedGet.response || '';
            const finalGetUrl = processedGet.url || getUrl;
            const resolved = resolveResultsUrl(finalGetUrl, htmlGet);
            if (resolved.resultUrl) {
              const pageParam = options?.page && options.page > 1 ? `&page=${options.page}` : '';
              const resultsPage = await fsClient.request(`${resolved.resultUrl}${pageParam}`, 'GET', undefined, undefined, headers, fsCookies, fsOptions);
              const pageResults = parseResults(resultsPage.response || '');
              const totalResults = extractTotalResults(resultsPage.response || '');
              return { results: pageResults, searchId: resolved.searchIdFromBody || undefined, totalResults };
            }
            const fallbackDirect = parseResults(htmlGet);
            if (fallbackDirect.length > 0) {
              const totalResults = extractTotalResults(htmlGet);
              return { results: fallbackDirect, searchId: resolved.searchIdFromBody || undefined, totalResults };
            }
          } catch (getErr) {
            logger.warn('search', `[${config.name}] FlareSolverr GET fallback failed`, { error: getErr instanceof Error ? getErr.message : String(getErr) });
          }
          return { results: [] };
        }

        // Pagination: single page or fetchAll
        if (options?.fetchAll) {
          const maxPages = Math.max(1, options.maxPages ?? 10);
          const aggregated: ForumSearchResult[] = [];
          const seen = new Set<string>();
          const totalResults = extractTotalResults(html);
          logger.info('search', `[${config.name}] FlareSolverr fetchAll: using resultUrl=${resultUrl}, searchId=${searchIdFromBody}, totalResults=${totalResults}`);
          for (let p = 1; p <= maxPages; p++) {
            const pageParam = p > 1 ? `&page=${p}` : '';
            const pageUrl = `${resultUrl}${pageParam}`;
            logger.info('search', `[${config.name}] FlareSolverr fetchAll page ${p}: ${pageUrl}`);
            const resultsPage = await fsClient.request(pageUrl, 'GET', undefined, undefined, headers, cookiesForFs, fsOptions);
            const pageResults = parseResults(resultsPage.response || '');
            logger.info('search', `[${config.name}] FlareSolverr fetchAll page ${p}: found ${pageResults.length} results`);
            let added = 0;
            for (const r of pageResults) {
              if (r.url && !seen.has(r.url)) {
                aggregated.push(r);
                seen.add(r.url);
                added++;
              }
            }
            logger.info('search', `[${config.name}] FlareSolverr fetchAll page ${p}: added ${added} new results (total: ${aggregated.length}/${totalResults})`);
            // Stop if we've collected all available results or no new results
            if (totalResults && aggregated.length >= totalResults) break;
            if (added === 0) break;
          }
          return { results: aggregated, searchId: searchIdFromBody || undefined, totalResults };
        }

        const pageParam = options?.page && options.page > 1 ? `&page=${options.page}` : '';
        const resultsPage = await fsClient.request(`${resultUrl}${pageParam}`, 'GET', undefined, undefined, headers, cookiesForFs, fsOptions);
        const pageResults = parseResults(resultsPage.response || '');
        const totalResults = extractTotalResults(resultsPage.response || '');
        return { results: pageResults, searchId: searchIdFromBody || undefined, totalResults };
      } catch (fsError) {
        logger.error('search', `[${config.name}] FlareSolverr fallback error:`, fsError);
        return { results: [] };
      }

    } catch (error) {
      console.error(`Search error for ${config.name}:`, error);
      return { results: [] };
    }
  }

  // Parse forum post to extract links
  // Fetch raw HTML of a post page without parsing (for custom link extraction)
  async fetchPostHtml(forumId: string, postUrl: string): Promise<string> {
    const config = this.configs.get(forumId);

    if (!config) {
      throw new Error(`Forum ${forumId} not configured`);
    }

    try {
      // Get the post page (fallback to FlareSolverr on 403/Cloudflare)
      return await this.fetchHtmlWithFallback(forumId, postUrl);
    } catch (error) {
      console.error(`HTML fetch error for ${config.name}:`, error);
      throw error;
    }
  }

  async parsePost(forumId: string, postUrl: string): Promise<ForumPost> {
    const config = this.configs.get(forumId);
    const client = this.clients.get(forumId);

    if (!config || !client) {
      throw new Error(`Forum ${forumId} not configured`);
    }

    try {
      // Get the post page (fallback to FlareSolverr on 403/Cloudflare)
      const html = await this.fetchHtmlWithFallback(forumId, postUrl);
      const $ = cheerio.load(html);

      // Extract post information
      const title = $(config.postTitleSelector || '.post-title, .topic-title, h1, h2').first().text().trim();
      const containerSelector = config.linksContainerSelector
        || '.post-content, .message-body, .post-body, #post_message, [id^="post_message_"]';
      
      // CRITICAL FIX: Use only the FIRST matching container, not all of them.
      // When parsing a post from a thread URL, we should extract links from the first post content only,
      // not from all posts in the thread (which would include comments, replies, etc.).
      // This prevents grabbing links from unrelated posts/messages on the same page.
      const firstContainer = $(containerSelector).first();
      const scopes = firstContainer.length > 0 ? [firstContainer] : [$('body')];

      const author = $('.author, .poster, .username').first().text().trim();
      const date = $('.date, .timestamp, .post-date').first().text().trim();
      // Extract links
      const forumHost = new URL(config.baseUrl).host;

      const isLikelyDownloadUrl = (href: string): boolean => {
        try {
          const u = new URL(href);
          if (!u.protocol.startsWith('http')) return false;
          if (u.host.endsWith(forumHost)) return false;

          // Skip obvious static assets (common when the selector falls back to a broad container)
          const pathname = u.pathname.toLowerCase();
          if (pathname.endsWith('.css') || pathname.endsWith('.js')) return false;
          if (pathname.endsWith('.png') || pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.gif') || pathname.endsWith('.webp') || pathname.endsWith('.svg') || pathname.endsWith('.ico')) return false;
          if (pathname.endsWith('.woff') || pathname.endsWith('.woff2') || pathname.endsWith('.ttf') || pathname.endsWith('.eot')) return false;
          return true;
        } catch {
          return false;
        }
      };

      const extractLinksFromScope = (scope: cheerio.Cheerio): { uniqueLinks: string[]; hosterLinks: string[] } => {
        const found: string[] = [];

        // Look for direct download links (prefer external hosters; skip internal forum URLs)
        scope.find('a[href]').each((index, element) => {
          const href = ($(element).attr('href') || '').trim();
          if (!href) return;
          if (!/^https?:\/\//i.test(href)) return;
          if (/^javascript:/i.test(href)) return;
          if (!isLikelyDownloadUrl(href)) return;
          found.push(href);
        });

        // Look for code blocks that might contain links
        scope.find('code, pre').each((index, element) => {
          const text = $(element).text();
          const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
          const matches = text.match(urlRegex);
          if (matches) {
            for (const m of matches) {
              if (!isLikelyDownloadUrl(m)) continue;
              found.push(m);
            }
          }
        });

        // IMPORTANT: Do NOT scan plain text from the entire scope.
        // This was causing extraction of unrelated links from page footers, scripts, and metadata.
        // Forum download post structures typically use:
        // - Direct <a> tags (already handled above)
        // - Code blocks for paste-friendly lists (already handled above)
        // Extracting from plain text creates false positives from tracking links, analytics, etc.
        // The "thank button" mechanism in grab/route.ts will reveal hidden link containers,
        // so we don't need broad text scanning here.

        const uniqueLinks = [...new Set(found)];
        const hosterLinks = uniqueLinks.filter((href) => {
          try {
            const u = new URL(href);
            return HOSTER_HOST_REGEX.test(u.host);
          } catch {
            return false;
          }
        });

        return { uniqueLinks, hosterLinks };
      };

      // In multi-post threads, the links may appear in a reply.
      // Choose the scope with the most detected hoster links.
      let best = { uniqueLinks: [] as string[], hosterLinks: [] as string[], textLen: 0 };
      let bestScope: cheerio.Cheerio | null = null;
      for (const scope of scopes) {
        const extracted = extractLinksFromScope(scope);
        const textLen = scope.text().trim().length;
        const better =
          extracted.hosterLinks.length > best.hosterLinks.length
          || (extracted.hosterLinks.length === best.hosterLinks.length && extracted.uniqueLinks.length > best.uniqueLinks.length)
          || (extracted.hosterLinks.length === best.hosterLinks.length && extracted.uniqueLinks.length === best.uniqueLinks.length && textLen > best.textLen);

        if (better) {
          best = { ...extracted, textLen };
          bestScope = scope;
        }
      }

      const content = bestScope?.html() || '';

      // Check if thank button is present
      const thankSelector = config.thankButtonSelector
        || '.thank-button, .thanks-btn, button[title*="thank" i], a[href*="post_thanks" i], a[href*="do=thank" i], a[href*="thanks" i]';
      const thankRequired = $(thankSelector).length > 0;

      return {
        title,
        content,
        // If we detected known hoster links, prefer returning only those.
        // This prevents polluting JDownloader with forum footer/social links.
        links: best.hosterLinks.length > 0 ? best.hosterLinks : best.uniqueLinks,
        author,
        date,
        forum: config.name,
        thankRequired
      };

    } catch (error) {
      console.error(`Post parsing error for ${config.name}:`, error);
      throw error;
    }
  }

  // Click thank button if required
  async clickThankButton(forumId: string, postUrl: string): Promise<boolean> {
    const config = this.configs.get(forumId);
    const client = this.clients.get(forumId);

    if (!config || !client) {
      return false;
    }

    try {
      // Get the post page to check for thank button (fallback to FlareSolverr on 403/Cloudflare)
      const html = await this.fetchHtmlWithFallback(forumId, postUrl);
      const $ = cheerio.load(html);

      const thankSelector = config.thankButtonSelector
        || '.thank-button, .thanks-btn, button[title*="thank" i], a[href*="post_thanks" i], a[href*="do=thank" i], a[href*="thanks" i]';
      const thankButton = $(thankSelector).first();

      if (thankButton.length === 0) {
        return true; // No thank button required
      }

      // Extract thank button action
      const thankUrl = thankButton.attr('href') || thankButton.data('url');
      const thankForm = thankButton.closest('form');

      if (thankUrl) {
        // Direct URL
        try {
          await client.get(thankUrl);
        } catch (error: any) {
          if (this.isAxiosBlockedByCloudflare(error)) {
            const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;
            if (flaresolverrUrl) {
              logger.warn('forum', `[${config.name}] Thank click blocked; retrying via FlareSolverr`);
              const fsClient = new FlareSolverrClient(flaresolverrUrl);
              const { cookies: storedCookies, userAgent: storedUserAgent } = this.parseStoredCookies(config.persistentCookies);
              const cookieHeader = FlareSolverrClient.cookiesToHeader(storedCookies as any);
              const headers: Record<string, string> = {
                ...(storedUserAgent ? { 'User-Agent': storedUserAgent } : {}),
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                'Accept-Language': 'es-ES,es;q=0.9',
              };
              await fsClient.request(thankUrl, 'GET', undefined, undefined, headers, storedCookies as any, {
                maxTimeout: 45000,
                requestTimeout: 60000,
              });
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      } else if (thankForm.length > 0) {
        // Form submission
        const formData: Record<string, string> = {};
        thankForm.find('input').each((index, element) => {
          const name = $(element).attr('name');
          const value = $(element).val() as string;
          if (name) {
            formData[name] = value || '';
          }
        });

        const actionUrl = thankForm.attr('action') || postUrl;
        try {
          await client.post(actionUrl, formData);
        } catch (error: any) {
          if (this.isAxiosBlockedByCloudflare(error)) {
            const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;
            if (flaresolverrUrl) {
              logger.warn('forum', `[${config.name}] Thank form blocked; retrying via FlareSolverr`);
              const fsClient = new FlareSolverrClient(flaresolverrUrl);
              const { cookies: storedCookies, userAgent: storedUserAgent } = this.parseStoredCookies(config.persistentCookies);
              const cookieHeader = FlareSolverrClient.cookiesToHeader(storedCookies as any);
              const headers: Record<string, string> = {
                ...(storedUserAgent ? { 'User-Agent': storedUserAgent } : {}),
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                'Accept-Language': 'es-ES,es;q=0.9',
              };
              await fsClient.request(actionUrl, 'POST', formData, undefined, headers, storedCookies as any, {
                maxTimeout: 45000,
                requestTimeout: 60000,
              });
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }

      // Wait a moment for the thank to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      return true;

    } catch (error) {
      console.error(`Thank button error for ${config.name}:`, error);
      return false;
    }
  }

  // Get all configured forums
  getForums(): ForumConfig[] {
    return Array.from(this.configs.values());
  }

  // Get forum by ID
  getForum(forumId: string): ForumConfig | undefined {
    return this.configs.get(forumId);
  }

  // Search wrapper (alias for searchForum)
  async search(
    forumId: string,
    query: string,
    options?: { page?: number; fetchAll?: boolean; maxPages?: number; titleOnly?: boolean; searchId?: string }
  ): Promise<ForumSearchResult[]> {
    const res = await this.searchForum(forumId, query, options);
    return res.results;
  }

  // Cleanup resources
  async cleanup(): Promise<void> {
    if (this.cfHandler) {
      await this.cfHandler.close();
      this.cfHandler = null;
    }
  }

  // Destructor
  async destroy(): Promise<void> {
    await this.cleanup();
  }
}