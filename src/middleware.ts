import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/edge-jwt';

// Extract token from request headers or cookies (edge-safe)
function extractToken(
    headers: Record<string, string>,
    cookies: Record<string, string>
): string | null {
    const authHeader = headers['authorization'];
    if (authHeader) {
        const match = authHeader.match(/Bearer\s+(\S+)/);
        if (match) return match[1];
    }
    if (cookies['sweaterr-auth']) return cookies['sweaterr-auth'];
    return null;
}

// Edge-compatible cache for setup status (no fs/process.cwd usage)
let _setupStatusCache: { needed: boolean; expiresAt: number } | null = null;
const SETUP_CACHE_TTL_MS = 60_000; // 60 seconds

async function getSetupStatus(): Promise<boolean> {
    const now = Date.now();
    if (_setupStatusCache && now < _setupStatusCache.expiresAt) {
        console.log('[Middleware] getSetupStatus (cached):', _setupStatusCache.needed);
        return _setupStatusCache.needed;
    }
    try {
        console.log('[Middleware] getSetupStatus: fetching /api/auth/users-count');
        const res = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://127.0.0.1:3000'}/api/auth/users-count`, {
            cache: 'no-store',
            headers: { 'X-Forwarded-For': '127.0.0.1' }
        });
        console.log('[Middleware] getSetupStatus: response status:', res.status);
        const data = await res.json();
        console.log('[Middleware] getSetupStatus: API response:', data);
        const needed = !(data.success && data.count > 0);
        console.log('[Middleware] getSetupStatus: calculated needed=', needed);
        _setupStatusCache = { needed, expiresAt: now + SETUP_CACHE_TTL_MS };
        return needed;
    } catch (err) {
        console.error('[Middleware] getSetupStatus: fetch failed, defaulting to true:', err);
        return true; // fallback: assume setup is needed
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // List of public routes that don't require authentication
    const publicRoutes = [
        '/login',
        '/api/auth/setup',
        '/api/auth/login',
        '/api/auth/reset-password', // Emergency password reset
        '/api/auth/me', // Check authentication status
        '/api/health', // Health check endpoint
        '/api/arr', // All *arr APIs are public
        '/api/qbittorrent', // qBittorrent-compatible API for Sonarr/Radarr integration
        '/api/sabnzbd', // SABnzbd-compatible API for *arr download client integration
        '/api/config/forums/check', // Forum connectivity test (allows unauthenticated testing)
        '/api/testing',
        '/api/logs', // Log viewer - endpoint has its own admin auth
    ];

    // Check if the current route is public
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    // Special handling for /setup: only allow when no users exist
    if (pathname === '/setup') {
        const setupNeeded = await getSetupStatus();
        if (!setupNeeded) {
            return NextResponse.redirect(new URL('/login', request.url), { status: 302 });
        }
        return NextResponse.next();
    }

    if (isPublicRoute) {
        return NextResponse.next();
    }

    // Extract token from headers or cookies
    const headers = Object.fromEntries(request.headers.entries());
    const cookies = Object.fromEntries(
        request.cookies
            .getAll()
            .map((c) => [c.name, c.value])
    );

    const token = extractToken(headers as Record<string, string>, cookies);

    // If no token, redirect to login
    if (!token) {
        const response = NextResponse.redirect(new URL('/login', request.url), {
            status: 302,
        });
        return response;
    }

    // Verify token in Edge runtime using jose
    const decoded = await verifyTokenEdge(token);
    if (!decoded) {
        // Token expired or invalid, redirect to login
        const response = NextResponse.redirect(new URL('/login', request.url), {
            status: 302,
        });
        response.cookies.delete('sweaterr-auth');
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next|static|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt)$).*)'],
};
