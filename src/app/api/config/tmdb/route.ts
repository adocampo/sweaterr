import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getTmdbSettings, invalidateTmdbCache } from '@/lib/services/tmdb-config';

const tmdbConfigSchema = z.object({
    apiKey: z.string().trim().min(1),
    enabled: z.boolean().default(true),
});

export async function GET() {
    try {
        return NextResponse.json({ success: true, data: await getTmdbSettings() });
    } catch (error) {
        console.error('Error fetching TMDB config:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch TMDB config' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const data = tmdbConfigSchema.parse(await request.json());
        await db.tmdbConfig.deleteMany();
        await db.tmdbConfig.create({ data });
        invalidateTmdbCache();
        return NextResponse.json({ success: true, data: await getTmdbSettings() });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.issues[0]?.message || 'Invalid configuration' }, { status: 400 });
        }
        console.error('Error saving TMDB config:', error);
        return NextResponse.json({ success: false, error: 'Failed to save TMDB config' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        await db.tmdbConfig.deleteMany();
        invalidateTmdbCache();
        return NextResponse.json({ success: true, data: await getTmdbSettings() });
    } catch (error) {
        console.error('Error deleting TMDB config:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete TMDB config' }, { status: 500 });
    }
}
