import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { ForumService } from '@/lib/services/forum';
import { AIService } from '@/lib/services/ai';

const searchSchema = z.object({
  query: z.string().min(1),
  forumId: z.string().optional(),
});

// POST /api/search - Search for content in forums
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, forumId } = searchSchema.parse(body);

    // Get enabled forums (filter by forumId if provided)
    const forums = await db.forum.findMany({
      where: {
        enabled: true,
        ...(forumId ? { id: forumId } : {}),
      },
      include: { credentials: true },
    });

    if (forums.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          query,
          results: [],
          total: 0,
          forums: [],
        },
        message: 'No forums configured',
      });
    }

    // Initialize services
    const forumService = new ForumService();
    const aiConfig = await db.aIConfig.findFirst({ where: { enabled: true } });
    let aiService: AIService | null = null;

    if (aiConfig) {
      aiService = new AIService({
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey || undefined,
        baseUrl: aiConfig.baseUrl || undefined,
        model: aiConfig.model || undefined,
      });
    }

    // Add forums to service and authenticate
    for (const forum of forums) {
      forumService.addForum({
        id: forum.id,
        name: forum.name,
        baseUrl: forum.baseUrl,
        searchPath: forum.searchPath,
        thankButtonSelector: forum.thankButtonSelector || undefined,
        linksContainerSelector: forum.linksContainerSelector || undefined,
        postTitleSelector: forum.postTitleSelector || undefined,
        credentials: forum.credentials ? {
          username: forum.credentials.username,
          password: forum.credentials.password,
        } : undefined,
      });

      if (forum.credentials) {
        await forumService.authenticate(forum.id);
      }
    }

    // Search all forums
    const allResults: any[] = [];
    for (const forum of forums) {
      try {
        const results = await forumService.search(forum.id, query);
        allResults.push(
          ...results.map((r) => ({ ...r, forumId: forum.id }))
        );
      } catch (error) {
        console.error(`Search failed for forum ${forum.name}:`, error);
      }
    }

    // Rank results with AI if available
    let rankedResults = allResults;
    if (aiService && allResults.length > 0) {
      try {
        rankedResults = await aiService.rankResults(
          allResults.map(r => ({
            title: r.title,
            url: r.url,
            forum: r.forum,
            relevanceScore: 0,
          })),
          query
        );
      } catch (error) {
        console.error('AI ranking failed:', error);
      }
    }

    // Save search history
    await db.searchHistory.create({
      data: {
        query,
        forumName: forums.map(f => f.name).join(', '),
        resultCount: rankedResults.length,
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        query,
        results: rankedResults,
        total: rankedResults.length,
        forums: forums.map(f => f.name),
      },
    });
  } catch (error) {
    console.error('Error in search:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}

// GET /api/search/history - Get search history
export async function GET() {
  try {
    const history = await db.searchHistory.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error fetching search history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch search history' },
      { status: 500 }
    );
  }
}