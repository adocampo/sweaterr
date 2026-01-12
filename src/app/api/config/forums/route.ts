import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const forumConfigSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  searchPath: z.string().optional(),
  searchMode: z.enum(['native', 'google_site', 'google_cse']).optional(),
  searchForumLabel: z.string().optional(),
  cseId: z.string().optional(),
  thankButtonSelector: z.string().optional(),
  linksContainerSelector: z.string().optional(),
  postTitleSelector: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  flaresolverrSessionTTL: z.number().min(5).max(1440).optional(),
});

// GET /api/config/forums - Get all forums
export async function GET() {
  try {
    const forums = await db.forum.findMany({
      include: {
        credentials: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: forums,
    });
  } catch (error) {
    console.error('Error fetching forums:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch forums' },
      { status: 500 }
    );
  }
}

// POST /api/config/forums - Create new forum
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = forumConfigSchema.parse(body);

    // Generate Torznab API key automatically
    const torznabApiKey = `fdd-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    const forum = await db.forum.create({
      data: {
        name: validatedData.name,
        baseUrl: validatedData.baseUrl,
        searchPath: validatedData.searchPath || '/search.php',
        searchMode: validatedData.searchMode,
        searchForumLabel: validatedData.searchForumLabel,
        cseId: validatedData.cseId,
        thankButtonSelector: validatedData.thankButtonSelector,
        linksContainerSelector: validatedData.linksContainerSelector,
        postTitleSelector: validatedData.postTitleSelector,
        torznabApiKey, // Auto-generated per forum
        // Store TTL in milliseconds. Incoming value is minutes.
        // If not provided, default to 30 minutes.
        flaresolverrSessionTTL:
          typeof validatedData.flaresolverrSessionTTL === 'number'
            ? validatedData.flaresolverrSessionTTL * 60 * 1000
            : 30 * 60 * 1000,
        credentials: validatedData.username && validatedData.password ? {
          create: {
            username: validatedData.username,
            password: validatedData.password, // In production, encrypt this
          },
        } : undefined,
      },
      include: {
        credentials: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: forum,
      message: 'Forum created. Newznab API key generated automatically.'
    });
  } catch (error) {
    console.error('Error creating forum:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create forum' },
      { status: 500 }
    );
  }
}