import axios from 'axios';
import { logger } from '@/lib/logger';

export interface FlareSolverrCookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
}

export interface FlareSolverrSolution {
    url: string;
    status: string;
    headers: Record<string, string>;
    cookies: Array<FlareSolverrCookie>;
    userAgent?: string;
    response?: string;
}

/** FlareSolverr reports failures as HTTP 500 with the real cause in the body. */
function flareSolverrMessage(err: any): string | null {
    const message = err?.response?.data?.message;
    if (typeof message !== 'string' || !message.trim()) return null;
    return message.trim().replace(/^Error:\s*/i, '');
}

export class FlareSolverrClient {
    private endpoint: string;

    constructor(endpoint: string) {
        this.endpoint = endpoint.replace(/\/$/, '');
    }

    /**
     * Cheap liveness check. A hung FlareSolverr still accepts TCP connections,
     * so only a real command tells us whether it can serve requests.
     */
    async ping(timeoutMs = 15000): Promise<{ version?: string; sessions: number }> {
        try {
            logger.debug('flaresolverr', `Ping ${this.endpoint}`);
            const { data } = await axios.post(
                `${this.endpoint}/v1`,
                { cmd: 'sessions.list' },
                { timeout: timeoutMs }
            );
            if (!data || data.status !== 'ok') {
                throw new Error(data?.message || 'unexpected response');
            }
            const sessions = (data.sessions || []).length;
            logger.info('flaresolverr', `Ping succeeded: ${sessions} active sessions`);
            return { version: data.version, sessions };
        } catch (err: any) {
            const reason = flareSolverrMessage(err)
                || (err?.code === 'ECONNABORTED' ? `no response within ${timeoutMs}ms` : err?.message)
                || 'unknown';
            logger.warn('flaresolverr', `Ping failed: ${reason}`);
            throw new Error(`FlareSolverr unreachable at ${this.endpoint}: ${reason}`);
        }
    }

    /**
     * Create a persistent session that can be reused across multiple requests
     * @returns Session ID to use in subsequent requests
     */
    async createSession(): Promise<string> {
        try {
            logger.info('flaresolverr', 'Creating session');
            const { data } = await axios.post(
                `${this.endpoint}/v1`,
                { cmd: 'sessions.create' },
                { timeout: 30000 }
            );
            if (!data || data.status !== 'ok' || !data.session) {
                throw new Error(`Failed to create session: ${data?.message || 'unknown error'}`);
            }
            logger.info('flaresolverr', 'Session created');
            return data.session;
        } catch (err: any) {
            const reason = flareSolverrMessage(err) || err?.message || 'unknown';
            logger.warn('flaresolverr', `Session creation failed: ${reason}`);
            throw new Error(`FlareSolverr session creation failed: ${reason}`);
        }
    }

    /**
     * Destroy a persistent session
     * @param sessionId Session ID to destroy
     */
    async destroySession(sessionId: string): Promise<void> {
        try {
            await axios.post(
                `${this.endpoint}/v1`,
                { cmd: 'sessions.destroy', session: sessionId },
                { timeout: 10000 }
            );
            logger.info('flaresolverr', 'Session destroyed');
        } catch (err: any) {
            // Silently ignore destruction errors
            logger.warn('flaresolverr', `Session destruction failed: ${err?.message || 'unknown'}`);
            console.warn(`Failed to destroy FlareSolverr session ${sessionId}:`, err?.message);
        }
    }

    async request(
        url: string,
        method: 'GET' | 'POST' = 'GET',
        postData?: Record<string, any>,
        sessionId?: string,
        headers?: Record<string, string>,
        cookies?: Array<FlareSolverrCookie>,
        options?: { maxTimeout?: number; requestTimeout?: number }
    ): Promise<FlareSolverrSolution> {
        const maxTimeout = options?.maxTimeout ?? 45000;
        const requestTimeout = options?.requestTimeout ?? 60000;

        const buildPayload = () => {
            const payload: any = {
                cmd: method === 'GET' ? 'request.get' : 'request.post',
                url,
                // Give the solver more time; Turnstile often needs >20s
                maxTimeout,
            };
            if (sessionId) {
                payload.session = sessionId;
            }
            // FlareSolverr v2+ expects userAgent field instead of generic headers
            if (headers && typeof headers['User-Agent'] === 'string' && headers['User-Agent'].trim()) {
                payload.userAgent = headers['User-Agent'];
            }
            if (cookies && cookies.length > 0) {
                payload.cookies = cookies;
            }
            if (method === 'POST' && postData) {
                payload.postData = new URLSearchParams(postData).toString();
            }
            return payload;
        };

        let lastErr: any = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                logger.info('flaresolverr', `${method} ${url} (attempt ${attempt}/2, timeout ${maxTimeout}ms)`);
                const { data } = await axios.post(`${this.endpoint}/v1`, buildPayload(), { timeout: requestTimeout });
                if (!data || data.status !== 'ok' || !data.solution) {
                    throw new Error(`FlareSolverr error: ${data?.message || 'unknown error'}`);
                }
                const solution = data.solution;
                const response = {
                    url: solution.url,
                    status: solution.status,
                    headers: solution.headers || {},
                    cookies: solution.cookies || [],
                    userAgent: solution.userAgent,
                    response: solution.response || '',
                };
                logger.info('flaresolverr', `${method} ${url} succeeded (${response.response.length} chars)`);
                return response;
            } catch (err: any) {
                const serverMessage = flareSolverrMessage(err);
                lastErr = serverMessage ? new Error(`FlareSolverr error: ${serverMessage}`) : err;
                // Retry only on transport timeouts; a solver failure will just fail again.
                const msg = String(err?.message || '');
                const isTimeout = !serverMessage
                    && (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out'));
                logger.warn('flaresolverr', `${method} ${url} failed on attempt ${attempt}/2: ${lastErr.message || msg}`);
                if (!isTimeout || attempt === 2) break;
                // brief backoff before retry
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        throw lastErr || new Error('FlareSolverr request failed');
    }

    static cookiesToHeader(cookies: Array<FlareSolverrCookie>): string {
        return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    }
}
