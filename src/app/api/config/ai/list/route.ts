import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const aiSchema = z.object({
    provider: z.string().min(1),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    model: z.string().optional(),
});

// GET /api/config/ai/list - Get all AI model instances
export async function GET() {
    try {
        const models = await db.aIConfig.findMany({
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            data: models,
        });
    } catch (error) {
        console.error('Error fetching AI models:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch AI models' },
            { status: 500 }
        );
    }
}

// POST /api/config/ai/list - Create new AI model instance
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validatedData = aiSchema.parse(body);

        const model = await db.aIConfig.create({
            data: {
                provider: validatedData.provider,
                apiKey: validatedData.apiKey,
                baseUrl: validatedData.baseUrl,
                model: validatedData.model,
                enabled: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: model,
        });
    } catch (error) {
        console.error('Error creating AI model:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create AI model' },
            { status: 500 }
        );
    }
}
