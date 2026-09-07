'use server';

import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { loginUser } from '@/lib/services/auth';

const userDelegate = () => (db as any).user as any;

/**
 * Login user via Server Action and set the auth cookie directly
 * (a nested fetch to /api/auth/login would set the cookie on that
 * internal response only, never reaching the browser).
 */
export async function loginAction(prevState: unknown, formData: FormData) {
    const usernameOrEmail = formData.get('usernameOrEmail');
    const password = formData.get('password');

    if (!usernameOrEmail || !password) {
        return { error: 'Username/Email and password are required' };
    }

    try {
        const result = await loginUser(String(usernameOrEmail), String(password));

        if (!result.success || !result.token) {
            return { error: result.message || 'Login failed' };
        }

        const cookieStore = await cookies();

        cookieStore.set('sweaterr-auth', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        });

        // Non-httpOnly cookie so the client can read the role instantly
        // (avoids waiting on /api/auth/me before rendering admin-only UI).
        cookieStore.set('sweaterr-user', JSON.stringify(result.user), {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        });

        return { success: true };
    } catch (error) {
        return { error: 'Network error. Please try again.' };
    }
}

/**
 * Check if setup is needed (no users exist)
 */
export async function checkSetupNeeded(): Promise<boolean> {
    try {
        const userCount = await userDelegate().count();
        return userCount === 0;
    } catch {
        return true;
    }
}
