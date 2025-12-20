import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { CloudflareHandler } from './cloudflare-handler';

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
  credentials?: {
    username: string;
    password: string;
  };
}

export class ForumService {
  private configs: Map<string, ForumConfig> = new Map();
  private clients: Map<string, AxiosInstance> = new Map();
  private cfHandler: CloudflareHandler | null = null;

  // Add forum configuration
  addForum(config: ForumConfig): void {
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
      console.log(`Forum ${config.name}: ${req.method?.toUpperCase()} ${req.url}`);
      return req;
    });

    client.interceptors.response.use(res => {
      console.log(`Forum ${config.name}: Response ${res.status} from ${res.config.url}`);
      return res;
    });

    this.clients.set(config.id, client);
  }

  // Authenticate with forum
  async authenticate(forumId: string): Promise<boolean> {
    const config = this.configs.get(forumId);
    const client = this.clients.get(forumId);

    if (!config || !client || !config.credentials) {
      console.log(`No authentication needed for ${config?.name || forumId}`);
      return false;
    }

    try {
      console.log(`Attempting authentication for ${config.name}...`);

      // Use Playwright for sites protected by Cloudflare
      console.log(`[${config.name}] Trying Playwright/headless browser approach for Cloudflare...`);

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
        console.log(`✓ Successfully authenticated with ${config.name}`);
        // Set cookies in axios client
        client.defaults.headers.Cookie = result.cookies;
        return true;
      }

      console.warn(`✗ Authentication failed for ${config.name}: ${result.error}`);
      return false;

    } catch (error: any) {
      console.error(`✗ Authentication error for ${config.name}:`, error.message);
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
        const res = await googleClient.get('/search', { params: { q: gq, hl: 'es' } });
        const $ = cheerio.load(res.data);
        const results: ForumSearchResult[] = [];

        // Google SERP parsing (best-effort; structure may vary)
        $('a').each((_, a) => {
          const href = $(a).attr('href') || '';
          const title = $(a).find('h3').text().trim() || $(a).text().trim();
          if (!href || !title) return;

          let url = href;
          // Google often uses /url?q=<url>
          if (href.startsWith('/url?')) {
            const u = new URL('https://www.google.com' + href);
            const q = u.searchParams.get('q');
            if (q) url = q;
          }

          try {
            const u = new URL(url);
            const forumHost = new URL(config.baseUrl).host;
            if (u.host.endsWith(forumHost)) {
              results.push({
                title,
                url,
                forum: config.name,
                hasLinks: false,
                thankRequired: false,
              });
            }
          } catch { }
        });

        // De-duplicate by URL
        const unique = new Map<string, ForumSearchResult>();
        results.forEach(r => { if (!unique.has(r.url)) unique.set(r.url, r); });
        return Array.from(unique.values());
      }

      // Default native search (legacy)
      const searchResponse = await client.get(config.searchPath, {
        params: {
          keywords: query,
          search: 'Search'
        }
      });

      const $ = cheerio.load(searchResponse.data);
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