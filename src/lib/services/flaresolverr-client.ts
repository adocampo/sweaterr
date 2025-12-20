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
        const payload: any = {
            cmd: method === 'GET' ? 'request.get' : 'request.post',
            url,
            maxTimeout: 20000,
        };

        if (method === 'POST' && postData) {
            payload.postData = new URLSearchParams(postData).toString();
        }

        const { data } = await axios.post(`${this.endpoint}/v1`, payload, { timeout: 25000 });

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
    }

    static cookiesToHeader(cookies: Array<{ name: string; value: string }>): string {
        return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    }
}
