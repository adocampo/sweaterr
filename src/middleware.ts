import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/services/auth';

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

  const token = extractToken(headers, cookies);

  // If no token, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token
  const decoded = verifyToken(token);
  if (!decoded) {
    // Token expired or invalid, redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('blazarr-auth');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|static|favicon.ico).*)'],
};
