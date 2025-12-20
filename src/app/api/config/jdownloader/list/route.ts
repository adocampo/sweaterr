import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const jdownloaderSchema = z.object({
    deviceName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(1),
});

// GET /api/config/jdownloader/list - Get all JDownloader instances
export async function GET() {
    try {
        const instances = await db.jDownloaderConfig.findMany({
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            data: instances,
        });
    } catch (error) {
        console.error('Error fetching JDownloader instances:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch JDownloader instances' },
            { status: 500 }
        );
    }
}

// POST /api/config/jdownloader/list - Create new JDownloader instance
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validatedData = jdownloaderSchema.parse(body);

        const instance = await db.jDownloaderConfig.create({
            data: {
                deviceName: validatedData.deviceName,
                email: validatedData.email,
                password: validatedData.password,
                enabled: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: instance,
        });
    } catch (error) {
        console.error('Error creating JDownloader instance:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create JDownloader instance' },
            { status: 500 }
        );
    }
}
