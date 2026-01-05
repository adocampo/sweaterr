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
  async searchForum(forumId: string, query: string): Promise<ForumSearchResult[]> {
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

        const gq = `site:${config.baseUrl.replace(/https?:\/\//, '')} ${query}`;
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
        return finalResults;
      }

      // If using Google CSE (Custom Search Engine)
      if (config.searchMode === 'google_cse') {
        // If cseId is not set, try to use a fallback ID (can be overridden in DB)
        const cseId = config.cseId || process.env.NEXT_PUBLIC_CSE_ID || '44f04a516a5b84434';

        logger.info('search', `Google CSE mode with ID: ${cseId}`);

        const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;

        if (!flaresolverrUrl) {
          logger.error('search', 'Google CSE requires FlareSolverr to be configured');
          return [];
        }

        try {
          const cseUrl = `https://cse.google.com/cse?cx=${cseId}&q=${encodeURIComponent(query)}`;
          logger.info('search', `Google CSE search URL: ${cseUrl}`);

          const FlareSolverrClientModule = await import('./flaresolverr-client');
          const cseClient = new FlareSolverrClientModule.FlareSolverrClient(flaresolverrUrl);
          const solution = await cseClient.request(cseUrl, 'GET');
          const html = solution.response || '';

          if (!html) {
            logger.warn('search', 'Google CSE returned empty response');
            return [];
          }

          logger.info('search', `Google CSE HTML length: ${html.length}`);

          const results: ForumSearchResult[] = [];
          const forumHost = new URL(config.baseUrl).host;

          // Parse Google CSE results using regex to extract showthread URLs
          // Google CSE wraps results in various containers, use regex for robustness
          // This regex handles:
          // - href="/showthread.php?p=123" or href='showthread.php?...'
          // - href="https://domain/showthread.php?..."
          // - Various text content in the <a> tag
          const showthreadRe = /<a[^>]*href=["']([^"']*showthread[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
          let match: RegExpExecArray | null;
          let matchCount = 0;

          while ((match = showthreadRe.exec(html)) !== null) {
            matchCount++;
            const url = match[1];
            const titleRaw = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

            if (titleRaw && url) {
              try {
                // Handle relative URLs
                let absoluteUrl = url;
                if (url.startsWith('/')) {
                  absoluteUrl = config.baseUrl + url;
                } else if (!url.startsWith('http')) {
                  absoluteUrl = config.baseUrl + '/' + url;
                }

                const u = new URL(absoluteUrl);
                logger.info('search', `CSE Match ${matchCount}: Checking URL ${absoluteUrl} (host: ${u.host})`);

                if (u.host.endsWith(forumHost)) {
                  results.push({
                    title: titleRaw,
                    url: absoluteUrl,
                    forum: config.name,
                    hasLinks: false,
                    thankRequired: false,
                  });
                  logger.info('search', `CSE Match ${matchCount}: ✓ Added result: ${titleRaw.substring(0, 80)}`);
                } else {
                  logger.info('search', `CSE Match ${matchCount}: Skipped (host mismatch: ${u.host} vs ${forumHost})`);
                }
              } catch (err) {
                logger.warn('search', `CSE Match ${matchCount}: Invalid URL: ${url}`, err);
              }
            } else {
              logger.info('search', `CSE Match ${matchCount}: Skipped (empty title or url)`);
            }
          }

          logger.info('search', `Google CSE parsed ${matchCount} showthread links, found ${results.length} valid results for "${query}"`);

          // De-duplicate by URL
          const unique = new Map<string, ForumSearchResult>();
          results.forEach(r => { if (!unique.has(r.url)) unique.set(r.url, r); });
          const finalResults = Array.from(unique.values());

          logger.info('search', `After deduplication: ${finalResults.length} unique results`);
          return finalResults;

        } catch (error) {
          logger.error('search', `Google CSE search error: ${error instanceof Error ? error.message : String(error)}`);
          if (error instanceof Error && error.stack) {
            logger.error('search', `Stack: ${error.stack.substring(0, 200)}`);
          }
          return [];
        }
      }

      // Default native search (legacy) with Cloudflare fallback via FlareSolverr
      let html: string | null = null;
      try {
        const searchResponse = await client.get(config.searchPath, {
          params: {
            keywords: query,
            search: 'Search'
          }
        });
        html = searchResponse.data;
      } catch (err: any) {
        const status = err?.response?.status;
        console.error(`Native search failed for ${config.name} (status ${status || 'unknown'}), trying FlareSolverr...`);
        const flaresolverrUrl = process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;
        if (flaresolverrUrl) {
          try {
            const qs = new URLSearchParams({ keywords: query, search: 'Search' }).toString();
            const fullUrl = `${config.baseUrl}${config.searchPath}?${qs}`;
            const { response } = await new (await import('./flaresolverr-client')).FlareSolverrClient(flaresolverrUrl).request(fullUrl, 'GET');
            html = response || '';
          } catch (fsErr: any) {
            console.error(`FlareSolverr search failed for ${config.name}:`, fsErr?.message || fsErr);
          }
        }
      }

      if (!html) {
        return [];
      }

      const $ = cheerio.load(html);
      const results: ForumSearchResult[] = [];

      $('.topic-list .topic, .search-result .result, tr.topic').each((index, element) => {
        const $element = $(element);
        const title = $element.find('.title a, .subject a, a[href*="topic"]').first().text().trim();
        const url = $element.find('.title a, .subject a, a[href*="topic"]').first().attr('href');
        const author = $element.find('.author, .poster, .username').first().text().trim();
        const replies = parseInt($element.find('.replies, .posts').first().text().replace(/[^\d]/g, '')) || 0;
        const views = parseInt($element.find('.views').first().text().replace(/[^\d]/g, '')) || 0;
        const date = $element.find('.date, .timestamp, .lastpost').first().text().trim();

        if (title && url) {
          results.push({
            title,
            url: url.startsWith('http') ? url : config.baseUrl + url,
            forum: config.name,
            date,
            author,
            replies,
            views,
            hasLinks: false,
            thankRequired: false,
          });
        }
      });

      return results;

    } catch (error) {
      console.error(`Search error for ${config.name}:`, error);
      return [];
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