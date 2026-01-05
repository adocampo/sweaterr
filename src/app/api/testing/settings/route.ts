import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyTokenEdge } from '@/lib/edge-jwt';

// GET /api/testing/settings - Get current testing settings
export async function GET(request: NextRequest) {
    try {
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

        const userId = payload.id;

        // Get or create testing settings
        let settings = await db.testingSettings.findUnique({
            where: { userId },
        });

        if (!settings) {
            settings = await db.testingSettings.create({
                data: { userId },
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                bypassAxios: settings.bypassAxios,
            },
        });
    } catch (error) {
        console.error('[Testing/Settings] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener configuración' },
            { status: 500 }
        );
    }
}

// PATCH /api/testing/settings - Update testing settings
export async function PATCH(request: NextRequest) {
    try {
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

        const userId = payload.id;
        const { bypassAxios } = await request.json();

        // Get or create testing settings
        let settings = await db.testingSettings.findUnique({
            where: { userId },
        });

        if (!settings) {
            settings = await db.testingSettings.create({
                data: { userId, bypassAxios: bypassAxios ?? false },
            });
        } else {
            settings = await db.testingSettings.update({
                where: { userId },
                data: { bypassAxios: bypassAxios ?? settings.bypassAxios },
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                bypassAxios: settings.bypassAxios,
            },
        });
    } catch (error) {
        console.error('[Testing/Settings] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al actualizar configuración' },
            { status: 500 }
        );
    }
}
