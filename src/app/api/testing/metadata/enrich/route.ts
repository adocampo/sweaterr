import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AIService } from '@/lib/services/ai';
import { enrichItemsWithAI, EnrichItem } from '@/lib/services/metadata-ai';
import { fetchPostContexts } from '@/lib/services/post-context';
import { resolveTitleFactsBatch } from '@/lib/services/tmdb';
import { detectType, extractYear } from '@/lib/metadata-extractor';
import { logger } from '@/lib/logger';

const MAX_ITEMS_PER_CALL = 25;

// POST /api/testing/metadata/enrich - Fill missing metadata with the configured LLM
export async function POST(request: NextRequest) {
    try {
        const { forumId, items, searchQuery, fetchPost = true } = await request.json();

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, error: 'No items provided' }, { status: 400 });
        }

        if (items.length > MAX_ITEMS_PER_CALL) {
            return NextResponse.json(
                { success: false, error: `Too many items (max ${MAX_ITEMS_PER_CALL})` },
                { status: 400 }
            );
        }

        const aiProvider = await db.aIConfig.findFirst({
            where: { enabled: true },
            orderBy: { createdAt: 'desc' },
        });

        if (!aiProvider) {
            return NextResponse.json(
                { success: false, error: 'No enabled AI provider configured' },
                { status: 400 }
            );
        }

        const forum = forumId
            ? await db.forum.findUnique({ where: { id: forumId }, select: { defaultLanguage: true, name: true } })
            : null;

        const aiService = new AIService({
            provider: aiProvider.provider,
            apiKey: aiProvider.apiKey || undefined,
            baseUrl: aiProvider.baseUrl || undefined,
            model: aiProvider.model || undefined,
            timeoutMs: 180000,
        });

        const normalized: EnrichItem[] = items
            .filter((item: any) => item && typeof item.title === 'string' && item.title.trim())
            .map((item: any) => ({
                url: String(item.url || ''),
                title: item.title,
                snippet: typeof item.snippet === 'string' ? item.snippet : '',
            }));

        const started = Date.now();

        // The opening post carries the synopsis, year and technical sheet the title omits.
        const postTexts = new Map<string, string>();
        let postFetchMs = 0;
        if (fetchPost && forumId) {
            const postStarted = Date.now();
            const urls = normalized.map((item) => item.url).filter(Boolean);
            const contexts = await fetchPostContexts(forumId, urls);
            for (const [url, context] of contexts) {
                if (context.firstPostText) postTexts.set(url, context.firstPostText);
            }
            postFetchMs = Date.now() - postStarted;
        }

        // TMDB gives the original language, needed to expand "Dual", plus genres and year.
        const refStarted = Date.now();
        const tmdbFailures: string[] = [];
        const references = await resolveTitleFactsBatch(
            normalized.map((item) => ({
                key: item.url,
                title: item.title,
                type: detectType(item.title, ''),
                year: extractYear(item.title),
            })),
            forum?.defaultLanguage || 'es-ES',
            (message) => tmdbFailures.push(message)
        );
        const referenceMs = Date.now() - refStarted;

        const results = await enrichItemsWithAI(normalized, aiService, {
            searchQuery,
            forumDefaultLanguage: forum?.defaultLanguage || undefined,
            concurrency: 1,
            postTexts,
            references,
        });
        const totalElapsedMs = Date.now() - started;

        logger.info('metadata', 'AI metadata returned to result viewer', {
            results: results.map((result) => ({
                url: result.url,
                genres: result.metadata?.genres || [],
                subtitleLanguages: result.metadata?.subtitleLanguages || [],
            })),
        });

        const applied = results.filter((r) => r.aiApplied).length;
        logger.info('metadata', `AI enrichment: ${applied}/${results.length} items in ${totalElapsedMs}ms`, {
            provider: aiProvider.provider,
            model: aiProvider.model,
                tmdbFailures: Array.from(new Set(tmdbFailures)),
            forum: forum?.name,
            postFetchMs,
            referenceMs,
            postsFetched: postTexts.size,
            referencesFound: Array.from(references.values()).filter(Boolean).length,
        });

        return NextResponse.json({
            success: true,
            data: {
                results,
                totalElapsedMs,
                postFetchMs,
                referenceMs,
                applied,
                provider: aiProvider.provider,
                model: aiProvider.model,
                tmdbWarning: tmdbFailures.length
                    ? `TMDB lookup failed: ${tmdbFailures[0]}. Check TMDB_API_KEY.`
                    : undefined,
            },
        });
    } catch (error: any) {
        const message = error?.message || 'Unknown error';
        logger.error('metadata', `AI enrichment failed: ${message}`);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
