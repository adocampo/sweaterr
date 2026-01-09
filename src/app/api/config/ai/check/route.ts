import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/services/ai';
import { z } from 'zod';

const testSchema = z.object({
    provider: z.string(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    model: z.string().optional(),
});

// POST /api/config/ai/check - Check AI configuration
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validated = testSchema.parse(body);

        // Create AI service instance
        const aiService = new AIService({
            provider: validated.provider,
            apiKey: validated.apiKey,
            baseUrl: validated.baseUrl,
            model: validated.model,
        });

        // Test with a simple query
        const testMapping = await aiService.mapToSceneName(
            'Breaking Bad T.5 WEBDL 1080p',
            'Breaking Bad'
        );

        if (!testMapping) {
            return NextResponse.json({
                success: false,
                error: 'AI provider test failed - no response',
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'AI provider is working',
            data: {
                testMapping,
            },
        });
    } catch (error: any) {
        console.error('Error testing AI config:', error);
        return NextResponse.json({
            success: false,
            error: `AI test failed: ${error.message}`,
        }, { status: 400 });
    }
}
