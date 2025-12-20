import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/config/jdownloader/list/[id] - Delete JDownloader instance
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await db.jDownloaderConfig.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'JDownloader instance deleted',
        });
    } catch (error) {
        console.error('Error deleting JDownloader instance:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete JDownloader instance' },
            { status: 500 }
        );
    }
}

// PATCH /api/config/jdownloader/list/[id]/toggle - Toggle JDownloader instance
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { enabled } = body;

        const instance = await db.jDownloaderConfig.update({
            where: { id },
            data: { enabled },
        });

        return NextResponse.json({
            success: true,
            data: instance,
        });
    } catch (error) {
        console.error('Error toggling JDownloader instance:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to toggle JDownloader instance' },
            { status: 500 }
        );
    }
}
