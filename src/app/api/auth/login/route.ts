import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/services/auth';

/**
 * POST /api/auth/login
 * Login user and return JWT token
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { usernameOrEmail, username, email, password } = body;

        const identifier = usernameOrEmail || username || email;

        if (!identifier || !password) {
            return NextResponse.json(
                { success: false, message: 'Username/Email and password are required' },
                { status: 400 }
            );
        }

        // Debug: minimal logging (avoid leaking secrets)
        console.log('[Login] Attempt', { identifierType: usernameOrEmail ? 'usernameOrEmail' : (username ? 'username' : 'email') });

        const result = await loginUser(identifier, password);

        if (!result.success) {
            return NextResponse.json({ success: false, message: result.message || 'Invalid credentials' }, { status: 401 });
        }

        // Set auth cookie
        const response = NextResponse.json({
            success: true,
            message: 'Login successful',
            user: result.user,
            token: result.token,
        });

        response.cookies.set('blazarr-auth', result.token!, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('[Login] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Login failed' },
            { status: 500 }
        );
    }
}
