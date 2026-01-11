import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// DELETE /api/config/arr/[id] - Delete ARR service
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await db.arrService.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'ARR service deleted',
        });
    } catch (error) {
        console.error('Error deleting ARR service:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete ARR service' },
            { status: 500 }
        );
    }
}

// PATCH /api/config/arr/[id] - Toggle ARR service enabled status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { enabled } = body;

        const service = await db.arrService.update({
            where: { id },
            data: { enabled },
        });

        return NextResponse.json({
            success: true,
            data: service,
        });
    } catch (error) {
        console.error('Error updating ARR service:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update ARR service' },
            { status: 500 }
        );
    }
}

// PUT /api/config/arr/[id] - Update ARR service (name/type)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const schema = z.object({
            type: z.enum(['sonarr', 'radarr', 'lidarr', 'readarr']).optional(),
            name: z.string().min(1).optional(),
        });
        const validated = schema.parse(body);

        const service = await db.arrService.update({
            where: { id },
            data: {
                ...(validated.type ? { type: validated.type } : {}),
                ...(validated.name ? { name: validated.name } : {}),
            },
        });

        return NextResponse.json({ success: true, data: service });
    } catch (error) {
        console.error('Error updating ARR service:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update ARR service' },
            { status: 500 }
        );
    }
}
