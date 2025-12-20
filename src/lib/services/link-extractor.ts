import { FlareSolverrClient } from './flaresolverr-client';

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
  flaresolverrUrl?: string
): Promise<ExtractLinksResult> {
  try {
    const flareUrl = flaresolverrUrl || process.env.FLARESOLVERR_URL;

    if (!flareUrl) {
      return { success: false, error: 'FlareSolverr URL not configured' };
    }

    // Step 1: Login if credentials provided
    let sessionCookies: Array<{ name: string; value: string }> = [];
    
    if (username && password) {
      const loginResult = await loginToForum(forumBaseUrl, username, password, flareUrl);
      if (!loginResult.success) {
        return { success: false, error: `Login failed: ${loginResult.error}` };
      }
      sessionCookies = loginResult.cookies || [];
    }

    // Step 2: Navigate to post with cookies
    const postResponse = await fetch(`${flareUrl}/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url: postUrl,
        maxTimeout: 60000,
        cookies: sessionCookies.length > 0 ? sessionCookies : undefined,
      }),
    });

    if (!postResponse.ok) {
      return { success: false, error: `Failed to fetch post: ${postResponse.statusText}` };
    }

    const postData = await postResponse.json();
    const html = postData.solution?.response || '';

    if (!html) {
      return { success: false, error: 'No HTML content received from post' };
    }

    // Step 3: Parse HTML to find post ID and thanks button
    const postIdMatch = postUrl.match(/[?&]p=(\d+)/);
    if (!postIdMatch) {
      return { success: false, error: 'Could not extract post ID from URL' };
    }
    const postId = postIdMatch[1];

    // Check if thanks button exists (user hasn't clicked yet)
    const hiddenContentId = `vfc_hide_thanks_post_${postId}`;
    const unhiddenContentId = `vfc_unhide_thanks_post_${postId}`;

    // Check if content is already unhidden (user already clicked thanks)
    if (html.includes(`id="${unhiddenContentId}"`)) {
      console.log('[LinkExtractor] Content already unhidden, extracting links directly');
      return extractLinksFromHTML(html);
    }

    // Check if hidden content exists (needs to click thanks)
    if (!html.includes(`id="${hiddenContentId}"`)) {
      return { success: false, error: 'No hidden content found (thanks mechanism not detected)' };
    }

    // Step 4: Find and construct thanks URL
    const thanksButtonMatch = html.match(/href="(post_thanks\.php\?[^"]+)"/);
    if (!thanksButtonMatch) {
      return { success: false, error: 'Thanks button not found in HTML' };
    }

    const thanksPath = thanksButtonMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/^\//, '');
    const thanksUrl = new URL(thanksPath, forumBaseUrl).toString();

    console.log('[LinkExtractor] Clicking thanks button:', thanksUrl);

    // Step 5: Click thanks button (GET request)
    const thanksResponse = await fetch(`${flareUrl}/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url: thanksUrl,
        maxTimeout: 60000,
        cookies: sessionCookies.length > 0 ? sessionCookies : undefined,
      }),
    });

    if (!thanksResponse.ok) {
      return { success: false, error: `Failed to click thanks button: ${thanksResponse.statusText}` };
    }

    // Step 6: Re-fetch post to get unhidden content
    const updatedPostResponse = await fetch(`${flareUrl}/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url: postUrl,
        maxTimeout: 60000,
        cookies: sessionCookies.length > 0 ? sessionCookies : undefined,
      }),
    });

    if (!updatedPostResponse.ok) {
      return { success: false, error: `Failed to re-fetch post: ${updatedPostResponse.statusText}` };
    }

    const updatedData = await updatedPostResponse.json();
    const updatedHtml = updatedData.solution?.response || '';

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
