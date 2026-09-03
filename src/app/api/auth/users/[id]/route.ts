import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, hashPassword } from '@/lib/services/auth';
import { db } from '@/lib/db';

const userDelegate = () => (db as any).user as any;
export const runtime = 'nodejs';

function requireAdmin(request: NextRequest) {
    const headers = Object.fromEntries(request.headers.entries());
    const cookies = Object.fromEntries(request.cookies.getAll().map((c) => [c.name, c.value]));
    const token = extractToken(headers, cookies);
    if (!token) return { ok: false, status: 401, message: 'No token provided' } as const;
    const decoded = verifyToken(token);
    if (!decoded) return { ok: false, status: 401, message: 'Invalid or expired token' } as const;
    if (decoded.role !== 'admin') return { ok: false, status: 403, message: 'Admin only' } as const;
    return { ok: true, userId: decoded.id } as const;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireAdmin(request);
    if (!auth.ok) {
        return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const userId = params.id;
    try {
        const body = await request.json();
        const { username, email, password, role, enabled } = body || {};

        const data: any = {};
        if (username) data.username = username;
        if (email) data.email = email;
        if (role) {
            if (role !== 'admin' && role !== 'user') {
                return NextResponse.json({ success: false, message: 'Invalid role' }, { status: 400 });
            }
            data.role = role;
        }
        if (typeof enabled === 'boolean') {
            if (enabled === false && auth.userId === userId) {
                return NextResponse.json({ success: false, message: 'Cannot disable your own account' }, { status: 400 });
            }
            if (enabled === false) {
                const targetUser = await userDelegate().findUnique({
                    where: { id: userId },
                    select: { role: true, enabled: true },
                });
                if (targetUser?.role === 'admin' && targetUser.enabled) {
                    const enabledAdminCount = await userDelegate().count({
                        where: { role: 'admin', enabled: true },
                    });
                    if (enabledAdminCount <= 1) {
                        return NextResponse.json({ success: false, message: 'Cannot disable the last enabled administrator' }, { status: 400 });
                    }
                }
            }
            data.enabled = enabled;
        }
        if (password) {
            if (password.length < 8) {
                return NextResponse.json({ success: false, message: 'Password must be at least 8 characters' }, { status: 400 });
            }
            data.passwordHash = await hashPassword(password);
        }

        const updated = await userDelegate().update({
            where: { id: userId },
            data,
            select: { id: true, username: true, email: true, role: true, enabled: true },
        });

        return NextResponse.json({ success: true, user: updated });
    } catch (error: any) {
        console.error('[Users] PATCH error', error);
        return NextResponse.json({ success: false, message: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireAdmin(request);
    if (!auth.ok) {
        return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const userId = params.id;
    if (auth.userId === userId) {
        return NextResponse.json({ success: false, message: 'Cannot delete your own account' }, { status: 400 });
    }

    try {
        const targetUser = await userDelegate().findUnique({
            where: { id: userId },
            select: { role: true, enabled: true },
        });
        if (targetUser?.role === 'admin' && targetUser.enabled) {
            const enabledAdminCount = await userDelegate().count({
                where: { role: 'admin', enabled: true },
            });
            if (enabledAdminCount <= 1) {
                return NextResponse.json({ success: false, message: 'Cannot delete the last enabled administrator' }, { status: 400 });
            }
        }

        await userDelegate().delete({ where: { id: userId } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Users] DELETE error', error);
        return NextResponse.json({ success: false, message: 'Failed to delete user' }, { status: 500 });
    }
}
