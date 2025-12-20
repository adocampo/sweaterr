import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const arrServiceSchema = z.object({
    type: z.enum(['sonarr', 'radarr', 'lidarr', 'readarr']),
    name: z.string(),
    enabled: z.boolean().default(true),
});

// GET /api/config/arr - Get all ARR services
export async function GET() {
    try {
        const services = await db.arrService.findMany({
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            data: services,
        });
    } catch (error) {
        console.error('Error fetching ARR services:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch ARR services' },
            { status: 500 }
        );
    }
}

// POST /api/config/arr - Create new ARR service
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validated = arrServiceSchema.parse(body);

        // Generate API key
        const apiKey = `fdd-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

        const service = await db.arrService.create({
            data: {
                ...validated,
                apiKey,
            },
        });

        return NextResponse.json({
            success: true,
            data: service,
            message: 'ARR service created. Save the API key!',
        });
    } catch (error) {
        console.error('Error creating ARR service:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create ARR service' },
            { status: 500 }
        );
    }
}
