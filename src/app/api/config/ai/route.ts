import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const aiConfigSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

// GET /api/config/ai - Get AI config
export async function GET() {
  try {
    const config = await db.aIConfig.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error fetching AI config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI config' },
      { status: 500 }
    );
  }
}

// POST /api/config/ai - Save AI config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = aiConfigSchema.parse(body);

    // Delete existing config
    await db.aIConfig.deleteMany();

    const config = await db.aIConfig.create({
      data: {
        provider: validatedData.provider,
        apiKey: validatedData.apiKey, // In production, encrypt this
        baseUrl: validatedData.baseUrl,
        model: validatedData.model,
      },
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error saving AI config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save AI config' },
      { status: 500 }
    );
  }
}

// DELETE /api/config/ai - Delete AI config
export async function DELETE() {
  try {
    await db.aIConfig.deleteMany();

    return NextResponse.json({
      success: true,
      message: 'AI config deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting AI config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete AI config' },
      { status: 500 }
    );
  }
}