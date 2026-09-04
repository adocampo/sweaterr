import { NextRequest, NextResponse } from 'next/server';
import { extractLinksFromPost } from '@/lib/services/link-extractor';
import { db } from '@/lib/db';

/**
 * POST /api/extract-links
 * Extract download links from a forum post by clicking "Gracias" button
 * 
 * Body:
 * {
 *   postUrl: string,    // Full URL to the forum post
 *   forumId: string     // Forum configuration ID from database
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { postUrl, forumId } = body;

        // Validate input
        if (!postUrl || typeof postUrl !== 'string') {
            return NextResponse.json(
                { success: false, error: 'postUrl is required' },
                { status: 400 }
            );
        }

        if (!forumId || typeof forumId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'forumId is required' },
                { status: 400 }
            );
        }

        // Get forum configuration from database
        const forumConfig = await (db as any).forum.findUnique({
            where: { id: forumId },
            include: { credentials: true },
        });

        if (!forumConfig) {
            return NextResponse.json(
                { success: false, error: 'Forum configuration not found' },
                { status: 404 }
            );
        }

        const { baseUrl, credentials, thankButtonSelector, linksContainerSelector, useFlaresolverr } = forumConfig;
        const username = credentials?.username;
        const password = credentials?.password;

        if (!baseUrl) {
            return NextResponse.json(
                { success: false, error: 'Forum base URL not configured' },
                { status: 400 }
            );
        }

        console.log('[API] Extracting links from:', postUrl);

        // Determine if FlareSolverr should be used for this forum
        const flareUrl = (useFlaresolverr !== false && process.env.FLARESOLVERR_URL) ? process.env.FLARESOLVERR_URL : undefined;

        // Extract links using the service (requires login to see thanks button)
        const result = await extractLinksFromPost(
            postUrl,
            baseUrl,
            username || undefined,
            password || undefined,
            flareUrl,
            forumId,
            {
                thankButtonSelector: thankButtonSelector || undefined,
                linksContainerSelector: linksContainerSelector || undefined,
            }
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        console.log(`[API] Successfully extracted ${result.links?.length || 0} links`);

        return NextResponse.json({
            success: true,
            links: result.links,
        });

    } catch (error) {
        console.error('[API] Extract links error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
