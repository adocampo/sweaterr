import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUserPreferences, verifyToken, extractToken } from '@/lib/services/auth';

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
export async function GET(request: NextRequest) {
    try {
        // Extract token from headers or cookies
        const headers = Object.fromEntries(request.headers.entries());
        const cookies = Object.fromEntries(
            request.cookies
                .getAll()
                .map((c) => [c.name, c.value])
        );

        const token = extractToken(headers, cookies);

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'No token provided' },
                { status: 401 }
            );
        }

        // Verify token
        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json(
                { success: false, message: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        // Get user details
        const user = await getUserById(decoded.id);
        if (!user) {
            return NextResponse.json(
                { success: false, message: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            user,
        });
    } catch (error) {
        console.error('[Auth] Get user error:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to get user' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/auth/me
 * Update current user preferences
 */
export async function PATCH(request: NextRequest) {
    try {
        // Extract token
        const headers = Object.fromEntries(request.headers.entries());
        const cookies = Object.fromEntries(
            request.cookies
                .getAll()
                .map((c) => [c.name, c.value])
        );

        const token = extractToken(headers, cookies);

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'No token provided' },
                { status: 401 }
            );
        }

        // Verify token
        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json(
                { success: false, message: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { language, theme } = body;

        // Update preferences
        const result = await updateUserPreferences(decoded.id, {
            language,
            theme,
        });

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Auth] Update user error:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to update user' },
            { status: 500 }
        );
    }
}
