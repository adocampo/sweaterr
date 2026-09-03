import { NextRequest, NextResponse } from 'next/server';
import { AIService, AI_PROVIDERS } from '@/lib/services/ai';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const modelsSchema = z.object({
    provider: z.string(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
});

// POST /api/config/ai/models - List the models the provider actually serves
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { provider, apiKey, baseUrl } = modelsSchema.parse(body);

        const spec = AI_PROVIDERS[provider];
        if (!spec) {
            return NextResponse.json({ success: false, error: `Unknown AI provider: ${provider}` }, { status: 400 });
        }

        const aiService = new AIService({ provider, apiKey, baseUrl });

        try {
            const models = await aiService.listModels();
            return NextResponse.json({
                success: true,
                data: { models: models.length ? models : spec.fallbackModels, source: models.length ? 'remote' : 'fallback' },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.warn('api', `AI model listing failed for ${provider}, using fallback`, { error: message });
            return NextResponse.json({
                success: true,
                data: { models: spec.fallbackModels, source: 'fallback', warning: message },
            });
        }
    } catch (error: any) {
        const message = error instanceof z.ZodError ? 'Invalid payload' : error?.message || 'Unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
}
