import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ForumService } from '@/lib/services/forum';
import { logger } from '@/lib/logger';

interface SearchResult {
    title: string;
    url: string;
    forum?: string;
}

export async function POST(request: NextRequest) {
    try {
        const { forumId, query } = await request.json();

        logger.info('search', `========================================`);
        logger.info('search', `=== NEW SEARCH REQUEST ===`);
        logger.info('search', `Forum ID: ${forumId}, Query: "${query}"`);
        logger.info('search', `========================================`);

        if (!forumId || !query) {
            logger.warn('search', 'Missing forumId or query');
            return NextResponse.json(
                { success: false, error: 'forumId y query son requeridos' },
                { status: 400 }
            );
        }

        // Get forum config from database
        logger.info('search', 'Fetching forum configuration from database...');
        const forum = await db.forum.findUnique({
            where: { id: forumId },
            include: { credentials: true },
        });

        if (!forum) {
            logger.error('search', `Forum not found with ID: ${forumId}`);
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        logger.info('search', `Forum found: ${forum.name}`);
        logger.info('search', `Search mode: ${(forum as any).searchMode || 'google_site'}`);

        // Initialize ForumService
        logger.info('search', 'Initializing ForumService...');
        const forumService = new ForumService();

        // Add forum to service
        logger.info('search', 'Adding forum to service...');
        forumService.addForum({
            id: forum.id,
            name: forum.name,
            baseUrl: forum.baseUrl,
            searchPath: forum.searchPath,
            credentials: forum.credentials.length > 0 ? forum.credentials[0] : undefined,
            cseId: (forum as any).cseId,
            searchMode: (forum as any).searchMode,
        });

        // Authenticate if needed
        if (forum.credentials.length > 0) {
            logger.info('search', `Authenticating for forum: ${forum.name}...`);
            try {
                const authSuccess = await forumService.authenticate(forum.id);
                logger.info('search', `Authentication result: ${authSuccess ? 'SUCCESS' : 'FAILED'}`);
            } catch (authErr) {
                logger.warn('search', `Authentication error: ${authErr}`);
            }
        } else {
            logger.info('search', 'No credentials configured, skipping authentication');
        }

        // Execute search
        logger.info('search', `Starting forum search for query: "${query}"`);
        const results = await forumService.searchForum(forum.id, query);

        logger.info('search', `========================================`);
        logger.info('search', `Search completed. Total results: ${results.length}`);
        results.slice(0, 5).forEach((r, i) => {
            logger.info('search', `  [${i + 1}] ${r.title.substring(0, 80)}`);
        });
        if (results.length > 5) {
            logger.info('search', `  ... and ${results.length - 5} more`);
        }
        logger.info('search', `========================================`);

        return NextResponse.json({
            success: true,
            results,
            searchMode: (forum as any).searchMode || 'google_site',
            forum: {
                id: forum.id,
                name: forum.name,
            },
        });

    } catch (error) {
        logger.error('search', `Error in search: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
            logger.error('search', `Stack trace: ${error.stack}`);
        }
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
