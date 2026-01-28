import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/services/auth';
import { db } from '@/lib/db';

const userDelegate = () => (db as any).user as any;

/**
 * POST /api/auth/reset-password
 * Emergency password reset - only works when exactly one user exists
 * This is a temporary endpoint for development/recovery
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, newPassword } = body;

        if (!username || !newPassword) {
            return NextResponse.json(
                { success: false, message: 'Username and new password are required' },
                { status: 400 }
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { success: false, message: 'Password must be at least 8 characters long' },
                { status: 400 }
            );
        }

        // Security check: only allow if there's exactly one user (emergency recovery)
        const userCount = await userDelegate().count();
        if (userCount !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Password reset only available when exactly one user exists',
                },
                { status: 403 }
            );
        }

        // Find user
        const user = await userDelegate().findUnique({
            where: { username },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'User not found' },
                { status: 404 }
            );
        }

        // Hash new password
        const passwordHash = await hashPassword(newPassword);

        // Update password
        await userDelegate().update({
            where: { username },
            data: { passwordHash },
        });

        console.log('[Reset Password] Password updated for user:', username);

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully',
        });
    } catch (error) {
        console.error('[Reset Password] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Password reset failed' },
            { status: 500 }
        );
    }
}
