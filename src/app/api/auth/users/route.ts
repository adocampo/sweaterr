import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { extractToken, verifyToken, hashPassword } from '@/lib/services/auth';

const prisma = new PrismaClient();
const userDelegate = () => (prisma as any).user as any;
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

export async function GET(request: NextRequest) {
    const auth = requireAdmin(request);
    if (!auth.ok) {
        return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const users = await userDelegate().findMany({
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            language: true,
            theme: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, users });
}

export async function POST(request: NextRequest) {
    const auth = requireAdmin(request);
    if (!auth.ok) {
        return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    try {
        const body = await request.json();
        const { username, email, password, role = 'user' } = body || {};

        if (!username || username.length < 3) {
            return NextResponse.json({ success: false, message: 'Username is required (min 3 chars)' }, { status: 400 });
        }
        if (!password || password.length < 8) {
            return NextResponse.json({ success: false, message: 'Password must be at least 8 characters' }, { status: 400 });
        }
        if (role !== 'admin' && role !== 'user') {
            return NextResponse.json({ success: false, message: 'Invalid role' }, { status: 400 });
        }

        const passwordHash = await hashPassword(password);

        const user = await userDelegate().create({
            data: {
                username,
                email: email || `${username}@blazarr.local`,
                passwordHash,
                role,
                language: 'es',
                theme: 'system',
                isFirstSetupDone: true,
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
            },
        });

        return NextResponse.json({ success: true, user });
    } catch (error: any) {
        console.error('[Users] POST error', error);
        return NextResponse.json({ success: false, message: 'Failed to create user' }, { status: 500 });
    }
}
