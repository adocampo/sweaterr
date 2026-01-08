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

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // List of public routes that don't require authentication
    const publicRoutes = [
        '/login',
        '/setup',
        '/api/auth/setup',
        '/api/auth/login',
        '/api/auth/reset-password', // Emergency password reset
        '/api/arr', // All *arr APIs are public
    ];

    // Check if the current route is public
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

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

    // console.log('[Middleware]', {
    //     pathname,
    //     hasToken: !!token,
    //     cookieNames: Object.keys(cookies),
    //     hasSweaterrAuth: !!cookies['sweaterr-auth']
    // });

    // If no token, redirect to login
    if (!token) {
        // console.log('[Middleware] No token found, redirecting to /login');
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verify token in Edge runtime using jose
    const decoded = await verifyTokenEdge(token);
    if (!decoded) {
        // console.log('[Middleware] Token verification failed, redirecting to /login');
        // Token expired or invalid, redirect to login
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('sweaterr-auth');
        return response;
    }

    // console.log('[Middleware] Token valid, user:', decoded.id);
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next|static|favicon.ico).*)'],
    runtime: 'nodejs',
};
