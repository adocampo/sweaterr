import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const forumConfigSchema = z.object({
    name: z.string().min(1),
    baseUrl: z.string().url(),
    searchPath: z.string().optional(),
    searchMode: z.enum(['native', 'google_site', 'google_cse']).optional(),
    searchForumLabel: z.string().optional(),
    searchInChildForums: z.boolean().optional(),
    searchTitleOnly: z.boolean().optional(),
    cseId: z.string().optional(),
    thankButtonSelector: z.string().optional(),
    linksContainerSelector: z.string().optional(),
    postTitleSelector: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    useFlaresolverr: z.boolean().optional(),
    flaresolverrSessionTTL: z.number().min(5).max(1440).optional(),
});

// PUT /api/config/forums/[id] - Update existing forum
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const validatedData = forumConfigSchema.parse(body);

        // Check if forum exists
        const existingForum = await db.forum.findUnique({
            where: { id },
            include: { credentials: true },
        });

        if (!existingForum) {
            return NextResponse.json(
                { success: false, error: 'Forum not found' },
                { status: 404 }
            );
        }

        // Update forum
        const forum = await db.forum.update({
            where: { id },
            data: {
                name: validatedData.name,
                baseUrl: validatedData.baseUrl,
                searchPath: validatedData.searchPath || '/search.php',
                searchMode: validatedData.searchMode,
                searchForumLabel: validatedData.searchForumLabel,
                searchInChildForums: validatedData.searchInChildForums ?? existingForum.searchInChildForums,
                searchTitleOnly: validatedData.searchTitleOnly ?? existingForum.searchTitleOnly,
                cseId: validatedData.cseId,
                thankButtonSelector: validatedData.thankButtonSelector,
                linksContainerSelector: validatedData.linksContainerSelector,
                postTitleSelector: validatedData.postTitleSelector,
                useFlaresolverr: validatedData.useFlaresolverr ?? existingForum.useFlaresolverr,
                // Persist TTL in milliseconds if provided (incoming value is minutes)
                flaresolverrSessionTTL:
                    typeof validatedData.flaresolverrSessionTTL === 'number'
                        ? validatedData.flaresolverrSessionTTL * 60 * 1000
                        : undefined,
                credentials: validatedData.username && validatedData.password
                    ? existingForum.credentials
                        ? {
                            update: {
                                username: validatedData.username,
                                password: validatedData.password,
                            },
                        }
                        : {
                            create: {
                                username: validatedData.username,
                                password: validatedData.password,
                            },
                        }
                    : existingForum.credentials
                        ? {
                            delete: true,
                        }
                        : undefined,
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
        console.error('Error updating forum:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update forum' },
            { status: 500 }
        );
    }
}

// DELETE /api/config/forums/[id] - Delete forum
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await db.forum.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error('Error deleting forum:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete forum' },
            { status: 500 }
        );
    }
}
