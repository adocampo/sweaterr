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

    async request(url: string, method: 'GET' | 'POST' = 'GET', postData?: Record<string, any>): Promise<FlareSolverrSolution> {
        const buildPayload = () => {
            const payload: any = {
                cmd: method === 'GET' ? 'request.get' : 'request.post',
                url,
                // Give the solver more time; Turnstile often needs >20s
                maxTimeout: 45000,
            };
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
