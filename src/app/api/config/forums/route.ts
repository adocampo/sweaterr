import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const forumConfigSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  searchPath: z.string().optional(),
  searchMode: z.enum(['native', 'google_site', 'google_cse']).optional(),
  cseId: z.string().optional(),
  thankButtonSelector: z.string().optional(),
  linksContainerSelector: z.string().optional(),
  postTitleSelector: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
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

    const forum = await db.forum.create({
      data: {
        name: validatedData.name,
        baseUrl: validatedData.baseUrl,
        searchPath: validatedData.searchPath,
        searchMode: validatedData.searchMode,
        cseId: validatedData.cseId,
        thankButtonSelector: validatedData.thankButtonSelector,
        linksContainerSelector: validatedData.linksContainerSelector,
        postTitleSelector: validatedData.postTitleSelector,
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
    });
  } catch (error) {
    console.error('Error creating forum:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create forum' },
      { status: 500 }
    );
  }
}