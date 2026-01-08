import axios from 'axios';

export interface FlareSolverrSolution {
    url: string;
    status: string;
    headers: Record<string, string>;
    cookies: Array<{ name: string; value: string }>;
    userAgent?: string;
    response?: string;
}

export class FlareSolverrClient {
    private endpoint: string;

    constructor(endpoint: string) {
        this.endpoint = endpoint.replace(/\/$/, '');
    }

    /**
     * Create a persistent session that can be reused across multiple requests
     * @returns Session ID to use in subsequent requests
     */
    async createSession(): Promise<string> {
        try {
            const { data } = await axios.post(
                `${this.endpoint}/v1`,
                { cmd: 'sessions.create' },
                { timeout: 30000 }
            );
            if (!data || data.status !== 'ok' || !data.session) {
                throw new Error(`Failed to create session: ${data?.message || 'unknown error'}`);
            }
            return data.session;
        } catch (err: any) {
            throw new Error(`FlareSolverr session creation failed: ${err?.message || 'unknown'}`);
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
        } catch (err: any) {
            // Silently ignore destruction errors
            console.warn(`Failed to destroy FlareSolverr session ${sessionId}:`, err?.message);
        }
    }

    async request(
        url: string,
        method: 'GET' | 'POST' = 'GET',
        postData?: Record<string, any>,
        sessionId?: string,
        headers?: Record<string, string>,
        cookies?: Array<{ name: string; value: string }>
    ): Promise<FlareSolverrSolution> {
        const buildPayload = () => {
            const payload: any = {
                cmd: method === 'GET' ? 'request.get' : 'request.post',
                url,
                // Give the solver more time; Turnstile often needs >20s
                maxTimeout: 45000,
            };
            if (sessionId) {
                payload.session = sessionId;
            }
            if (headers && Object.keys(headers).length > 0) {
                payload.headers = headers;
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
                const { data } = await axios.post(`${this.endpoint}/v1`, buildPayload(), { timeout: 60000 });
                if (!data || data.status !== 'ok' || !data.solution) {
                    throw new Error(`FlareSolverr error: ${data?.message || 'unknown error'}`);
                }
                const solution = data.solution;
                return {
                    url: solution.url,
                    status: solution.status,
                    headers: solution.headers || {},
                    cookies: solution.cookies || [],
                    userAgent: solution.userAgent,
                    response: solution.response || '',
                };
            } catch (err: any) {
                lastErr = err;
                const msg = String(err?.message || '');
                const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out');
                if (!isTimeout || attempt === 2) break;
                // brief backoff before retry
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        throw lastErr || new Error('FlareSolverr request failed');
    }

    static cookiesToHeader(cookies: Array<{ name: string; value: string }>): string {
        return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    }
}
