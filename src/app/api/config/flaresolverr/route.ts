import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
    DEFAULT_FLARESOLVERR_TIMEOUT,
    getFlareSolverrSettings,
    invalidateFlareSolverrCache,
} from '@/lib/services/flaresolverr-config';

const flaresolverrConfigSchema = z.object({
    url: z.string().trim().url().refine(
        (value) => value.startsWith('http://') || value.startsWith('https://'),
        { message: 'URL must use http or https' }
    ),
    timeout: z.number().int().min(5000).max(180000).default(DEFAULT_FLARESOLVERR_TIMEOUT),
    enabled: z.boolean().default(true),
});

// GET /api/config/flaresolverr - Current settings (database, or environment fallback)
export async function GET() {
    try {
        const settings = await getFlareSolverrSettings();
        return NextResponse.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error fetching FlareSolverr config:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch FlareSolverr config' },
            { status: 500 }
        );
    }
}

// POST /api/config/flaresolverr - Replace settings
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = flaresolverrConfigSchema.parse(body);

        await db.flareSolverrConfig.deleteMany();
        await db.flareSolverrConfig.create({
            data: {
                url: data.url.replace(/\/+$/, ''),
                timeout: data.timeout,
                enabled: data.enabled,
            },
        });
        invalidateFlareSolverrCache();

        return NextResponse.json({ success: true, data: await getFlareSolverrSettings() });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: error.errors[0]?.message || 'Invalid configuration' },
                { status: 400 }
            );
        }
        console.error('Error saving FlareSolverr config:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save FlareSolverr config' },
            { status: 500 }
        );
    }
}

// PUT /api/config/flaresolverr - Toggle enabled state without resetting the URL
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const enabled = typeof body?.enabled === 'boolean' ? body.enabled : true;

        const current = await db.flareSolverrConfig.findFirst({ orderBy: { createdAt: 'desc' } });
        if (!current) {
            const envSettings = await getFlareSolverrSettings();
            if (!envSettings.url) {
                return NextResponse.json(
                    { success: false, error: 'No FlareSolverr URL configured' },
                    { status: 400 }
                );
            }

            await db.flareSolverrConfig.create({
                data: {
                    url: envSettings.url,
                    timeout: envSettings.timeout,
                    enabled,
                },
            });
        } else {
            await db.flareSolverrConfig.update({
                where: { id: current.id },
                data: { enabled },
            });
        }

        invalidateFlareSolverrCache();
        return NextResponse.json({ success: true, data: await getFlareSolverrSettings() });
    } catch (error) {
        console.error('Error toggling FlareSolverr config:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to toggle FlareSolverr config' },
            { status: 500 }
        );
    }
}

// DELETE /api/config/flaresolverr - Back to the environment variable
export async function DELETE() {
    try {
        await db.flareSolverrConfig.deleteMany();
        invalidateFlareSolverrCache();
        return NextResponse.json({ success: true, data: await getFlareSolverrSettings() });
    } catch (error) {
        console.error('Error deleting FlareSolverr config:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete FlareSolverr config' },
            { status: 500 }
        );
    }
}
