import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { CloudflareHandler } from './cloudflare-handler';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

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

export interface ForumConfig {
  id: string;
  name: string;
  baseUrl: string;
  searchPath: string;
  searchMode?: 'native' | 'google_site' | 'google_cse';
  searchForumLabel?: string;
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
      // If using Google site: search
      if (config.searchMode === 'google_site') {
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
        // Match URLs like: search.php?searchid=123 or search.php?do=process&searchid=123&page=2
        const match = input.match(/search\.php\?[^\s"'>]*searchid=\d+[^\s"'>]*/i);
        if (!match) return '';
        return match[0];
      };

      const extractSearchIdValue = (input: string) => {
        if (!input) return '';
        const m = input.match(/name=["']searchid["'][^>]*value=["'](\d+)["']/i);
        return m?.[1] || '';
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

        const selectors = [
          'a[id^="thread_title"]',
          'a.threadtitle',
          'h3.searchtitle a',
          'h3 a.threadtitle',
          'a[href*="showthread.php?t="]',
        ];

        const addResult = ($a: cheerio.Cheerio<cheerio.Element>) => {
          const href = getAbs($a.attr('href') || '');
          if (!href || seen.has(href)) return;
          if (!/showthread\.php\?t=\d+/i.test(href)) return;
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

          out.push({
            title,
            url: href,
            forum: forumText || config.name,
            date: dateText,
            hasLinks: false,
            thankRequired: false,
            snippet: snippet || undefined,
          });
          seen.add(href);
        };

        selectors.forEach((sel) => {
          $(sel).each((_, el) => addResult($(el)));
        });

        if (out.length === 0) {
          $('a[href*="showthread.php"]').each((_, el) => addResult($(el)));
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
              foundValue = optValue || optText;
            }
          });

          if (foundValue) {
            tryApply(selName, foundValue);
            postData['childforums'] = postData['childforums'] || '1';
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
            postData['childforums'] = postData['childforums'] || '1';
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
        postData['childforums'] = postData['childforums'] || '1';
        postData['do'] = postData['do'] || 'process';
        postData['search_type'] = postData['search_type'] || '1';

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
        if (options?.titleOnly) {
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
        // Pass cookies as array to FlareSolverr (NOT as Cookie header - that doesn't work)
        const firstPage = await fsClient.request(firstPageUrl, 'GET', undefined, undefined, headers, cookiesForFs, fsOptions);
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

        const processed = await fsClient.request(action, 'POST', postData, undefined, postHeaders, cookiesForFs, fsOptions);

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
  async parsePost(forumId: string, postUrl: string): Promise<ForumPost> {
    const config = this.configs.get(forumId);
    const client = this.clients.get(forumId);

    if (!config || !client) {
      throw new Error(`Forum ${forumId} not configured`);
    }

    try {
      // Get the post page
      const postResponse = await client.get(postUrl);
      const $ = cheerio.load(postResponse.data);

      // Extract post information
      const title = $(config.postTitleSelector || '.post-title, .topic-title, h1, h2').first().text().trim();
      const content = $(config.linksContainerSelector || '.post-content, .message-body, .post-body').first().html() || '';
      const author = $('.author, .poster, .username').first().text().trim();
      const date = $('.date, .timestamp, .post-date').first().text().trim();

      // Extract links
      const links: string[] = [];

      // Look for direct download links
      $('a[href*="http"]').each((index, element) => {
        const href = $(element).attr('href');
        if (href && href.startsWith('http') && !href.includes('javascript:')) {
          links.push(href);
        }
      });

      // Look for code blocks that might contain links
      $('code, pre').each((index, element) => {
        const text = $(element).text();
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
        const matches = text.match(urlRegex);
        if (matches) {
          links.push(...matches);
        }
      });

      // Check if thank button is present
      const thankRequired = $(config.thankButtonSelector || '.thank-button, .thanks-btn, button[title*="thank"]').length > 0;

      return {
        title,
        content,
        links: [...new Set(links)], // Remove duplicates
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
      // Get the post page to check for thank button
      const postResponse = await client.get(postUrl);
      const $ = cheerio.load(postResponse.data);

      const thankButton = $(config.thankButtonSelector || '.thank-button, .thanks-btn, button[title*="thank"]').first();

      if (thankButton.length === 0) {
        return true; // No thank button required
      }

      // Extract thank button action
      const thankUrl = thankButton.attr('href') || thankButton.data('url');
      const thankForm = thankButton.closest('form');

      if (thankUrl) {
        // Direct URL
        await client.get(thankUrl);
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

        await client.post(thankForm.attr('action') || postUrl, formData);
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
  async search(forumId: string, query: string): Promise<ForumSearchResult[]> {
    return this.searchForum(forumId, query);
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