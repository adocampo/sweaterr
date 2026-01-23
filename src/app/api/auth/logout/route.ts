import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * Logout user by clearing the auth cookie
 */
export async function POST(request: NextRequest) {
    const response = NextResponse.json({
        success: true,
        message: 'Logged out successfully',
    });

    const forwardedProto = request.headers.get('x-forwarded-proto');
    const isHttps = forwardedProto === 'https' || request.nextUrl.protocol === 'https:';

    response.cookies.set('sweaterr-auth', '', {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });

    return response;
}
