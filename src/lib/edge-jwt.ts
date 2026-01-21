import { jwtVerify } from 'jose';

export interface EdgeDecodedToken {
    id: string;
    email: string;
    role: 'admin' | 'user';
    iat: number;
    exp: number;
}

export async function verifyTokenEdge(token: string): Promise<EdgeDecodedToken | null> {
    try {
        const secretString = process.env.JWT_SECRET;
        if (!secretString) {
            console.error('[EdgeAuth] JWT_SECRET environment variable is not set');
            return null;
        }
        const secret = new TextEncoder().encode(secretString);
        const { payload } = await jwtVerify(token, secret);
        return payload as EdgeDecodedToken;
    } catch (error) {
        console.error('[EdgeAuth] jwtVerify error:', error instanceof Error ? error.message : error);
        return null;
    }
}
