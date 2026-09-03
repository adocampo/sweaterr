import { NextRequest, NextResponse } from 'next/server';
import { AIService, parseJsonLoose } from '@/lib/services/ai';
import { logger } from '@/lib/logger';
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

        const aiService = new AIService({
            provider: validated.provider,
            apiKey: validated.apiKey,
            baseUrl: validated.baseUrl,
            model: validated.model,
            timeoutMs: 30000,
        });

        const started = Date.now();
        const raw = await aiService.callAIOrThrow(
            'Reply with this exact JSON and nothing else: {"ok":true}',
            { json: true }
        );
        const elapsedMs = Date.now() - started;

        let models: string[] = [];
        try {
            models = await aiService.listModels();
        } catch (err) {
            logger.warn('api', 'AI check: model listing unavailable', {
                error: err instanceof Error ? err.message : String(err),
            });
        }

        return NextResponse.json({
            success: true,
            message: 'AI provider is working',
            data: {
                elapsedMs,
                // A model that ignores the JSON instruction still proves connectivity.
                validJson: !!parseJsonLoose(raw),
                sample: raw.slice(0, 200),
                models,
            },
        });
    } catch (error: any) {
        const message = error instanceof z.ZodError
            ? 'Invalid AI configuration payload'
            : error?.message || 'Unknown error';
        logger.error('api', `AI check failed: ${message}`);
        return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
}
