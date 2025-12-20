import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// DELETE /api/config/ai/list/[id] - Delete AI model instance
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await db.aIConfig.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'AI model deleted',
        });
    } catch (error) {
        console.error('Error deleting AI model:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete AI model' },
            { status: 500 }
        );
    }
}

// PATCH /api/config/ai/list/[id]/toggle - Toggle AI model instance
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { enabled } = body;

        const model = await db.aIConfig.update({
            where: { id },
            data: { enabled },
        });

        return NextResponse.json({
            success: true,
            data: model,
        });
    } catch (error) {
        console.error('Error toggling AI model:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to toggle AI model' },
            { status: 500 }
        );
    }
}

// PUT /api/config/ai/list/[id] - Update AI model settings
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const aiSchema = z.object({
            provider: z.string().min(1),
            apiKey: z.string().optional().nullable(),
            baseUrl: z.string().optional().nullable(),
            model: z.string().optional().nullable(),
        });

        const validated = aiSchema.parse(body);

        const model = await db.aIConfig.update({
            where: { id },
            data: {
                provider: validated.provider,
                apiKey: validated.apiKey || null,
                baseUrl: validated.baseUrl || null,
                model: validated.model || null,
            },
        });

        return NextResponse.json({ success: true, data: model });
    } catch (error) {
        console.error('Error updating AI model:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update AI model' },
            { status: 500 }
        );
    }
}
