import { CookieJar } from 'tough-cookie';

// Simple in-memory CookieJar registry keyed by hostname.
// This mimics a long-lived browser session across API requests.
const registry = new Map<string, CookieJar>();

/**
 * Get or create a CookieJar for a given hostname.
 * The jar lives for the server process lifetime (in-memory).
 */
export function getJarForHost(hostname: string): CookieJar {
    let jar = registry.get(hostname);
    if (!jar) {
        jar = new CookieJar();
        registry.set(hostname, jar);
    }
    return jar;
}

/**
 * Preload cookies into the jar from a persisted array format.
 * Expects items like { name, value }. Additional attributes are ignored.
 */
export async function preloadJarCookies(
    jar: CookieJar,
    url: string,
    cookies: Array<{ name: string; value: string; domain?: string; path?: string }>
): Promise<void> {
    const host = new URL(url).hostname;
    for (const c of cookies) {
        const domain = c.domain || host;
        const path = c.path || '/';
        try {
            await jar.setCookie(`${c.name}=${c.value}; Domain=${domain}; Path=${path}; Secure; SameSite=Lax`, url);
        } catch {
            // Ignore malformed cookies silently
        }
    }
}
