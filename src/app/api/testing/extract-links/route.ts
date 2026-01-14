import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractLinksFromPost } from '@/lib/services/link-extractor';

export async function POST(request: NextRequest) {
    try {
        const { forumId, postUrl } = await request.json();

        if (!forumId || !postUrl) {
            return NextResponse.json(
                { success: false, error: 'forumId y postUrl son requeridos' },
                { status: 400 }
            );
        }

        // Load forum with credentials
        const forum = await db.forum.findUnique({
            where: { id: forumId },
            include: {
                credentials: true,
            },
        });

        if (!forum) {
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        // Use the working link extraction function
        const result = await extractLinksFromPost(
            postUrl,
            forum.baseUrl,
            forum.credentials?.username,
            forum.credentials?.password,
            process.env.FLARESOLVERR_URL,
            forumId
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || 'Error al extraer enlaces' },
                { status: 500 }
            );
        }

        // Convert string URLs to objects with url property
        const formattedLinks = (result.links || []).map(url => ({
            url,
            hosting: '', // extractLinksFromPost doesn't provide hosting info
            filename: undefined,
        }));

        console.log('[Testing/ExtractLinks] Extracted', formattedLinks.length, 'links');

        return NextResponse.json({
            success: true,
            links: formattedLinks,
            postUrl,
        });

    } catch (error) {
        console.error('[Testing/ExtractLinks] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al extraer enlaces' },
            { status: 500 }
        );
    }
}
