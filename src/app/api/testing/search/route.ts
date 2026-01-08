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
        const { forumId, query, page, fetchAll, maxPages, titleOnly, searchId } = await request.json();

        logger.info('search', `========================================`);
        logger.info('search', `=== NEW SEARCH REQUEST ===`);
        logger.info('search', `Forum ID: ${forumId}, Query: "${query}"`);
        if (searchId) {
            logger.info('search', `Using existing searchId: ${searchId} for pagination`);
        }
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
            persistentCookies: (forum as any).persistentCookies || undefined,
            credentials: forum.credentials ? {
                username: (forum.credentials as any).username,
                password: (forum.credentials as any).password,
            } : undefined,
            cseId: (forum as any).cseId,
            searchMode: (forum as any).searchMode,
            searchForumLabel: (forum as any).searchForumLabel || undefined,
        });

        // Authenticate if needed
        if (forum.credentials) {
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
        logger.info('search', `Starting forum search for query: "${query}" (page=${page || 1}, fetchAll=${!!fetchAll}, searchId=${searchId || 'none'})`);
        const response = await forumService.searchForum(forum.id, query, {
            page: typeof page === 'number' ? page : undefined,
            fetchAll: !!fetchAll,
            maxPages: typeof maxPages === 'number' ? maxPages : undefined,
            titleOnly: !!titleOnly,
            searchId: searchId || undefined,
        });

        logger.info('search', `========================================`);
        logger.info('search', `Search completed. Total results: ${response.results.length}`);
        if (response.totalResults) {
          logger.info('search', `Total available in forum: ${response.totalResults}`);
        }
        if (response.searchId) {
          logger.info('search', `SearchId returned: ${response.searchId}`);
        }
        response.results.slice(0, 5).forEach((r, i) => {
          logger.info('search', `  [${i + 1}] ${r.title.substring(0, 80)}`);
        });
        if (response.results.length > 5) {
          logger.info('search', `  ... and ${response.results.length - 5} more`);
        }
        logger.info('search', `========================================`);

        return NextResponse.json({
          success: true,
          results: response.results,
          searchId: response.searchId,
          totalResults: response.totalResults,
          searchMode: (forum as any).searchMode || 'google_site',
          forum: {
            id: forum.id,
            name: forum.name,
          },
          page: typeof page === 'number' ? page : 1,
          fetchAll: !!fetchAll,
          titleOnly: !!titleOnly,
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
