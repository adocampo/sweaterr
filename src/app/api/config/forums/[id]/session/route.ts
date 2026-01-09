import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionManager } from '@/lib/services/flaresolverr-session-manager';
import { verifyTokenEdge } from '@/lib/edge-jwt';

// GET /api/config/forums/[id]/session - Get session info
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = request.cookies.get('sweaterr-auth')?.value;
        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const payload = await verifyTokenEdge(token);
        if (!payload || typeof payload.id !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Invalid token' },
                { status: 401 }
            );
        }

        const forum = await db.forum.findUnique({
            where: { id },
        });

        if (!forum) {
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        const sessionInfo = sessionManager.getSessionInfo(id);
        const ttlMs = forum.flaresolverrSessionTTL || 30 * 60 * 1000;

        console.log(`[SessionAPI] GET session for forum ${id}:`, {
            sessionFound: !!sessionInfo,
            sessionId: sessionInfo?.sessionId?.substring(0, 8),
            ageSeconds: sessionInfo ? Math.round(sessionInfo.ageMs / 1000) : null,
            expiresInSeconds: sessionInfo ? Math.round(sessionInfo.expiresInMs / 1000) : null,
        });

        return NextResponse.json({
            success: true,
            data: {
                forumId: id,
                forumName: forum.name,
                ttlMs,
                ttlMinutes: Math.round(ttlMs / 60000),
                session: sessionInfo
                    ? {
                        sessionId: sessionInfo.sessionId,
                        ageSeconds: Math.round(sessionInfo.ageMs / 1000),
                        expiresInSeconds: Math.round(sessionInfo.expiresInMs / 1000),
                        isExpired: sessionInfo.isExpired,
                    }
                    : null,
            },
        });
    } catch (error) {
        console.error('[Config/Forum Session] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener sesión' },
            { status: 500 }
        );
    }
}

// PATCH /api/config/forums/[id]/session - Update session TTL
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = request.cookies.get('sweaterr-auth')?.value;
        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const payload = await verifyTokenEdge(token);
        if (!payload || typeof payload.id !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Invalid token' },
                { status: 401 }
            );
        }

        const forum = await db.forum.findUnique({
            where: { id },
        });

        if (!forum) {
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        const { ttlMinutes } = await request.json();

        if (typeof ttlMinutes !== 'number' || ttlMinutes < 1 || ttlMinutes > 1440) {
            return NextResponse.json(
                { success: false, error: 'La duración de sesión debe estar entre 1 y 1440 minutos (24 horas)' },
                { status: 400 }
            );
        }

        const ttlMs = ttlMinutes * 60 * 1000;

        await db.forum.update({
            where: { id },
            data: { flaresolverrSessionTTL: ttlMs },
        });

        return NextResponse.json({
            success: true,
            data: {
                ttlMs,
                ttlMinutes,
            },
        });
    } catch (error) {
        console.error('[Config/Forum Session] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al actualizar TTL' },
            { status: 500 }
        );
    }
}
