import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractLinksFromPostWithThankClick } from '@/lib/services/link-extractor';

export async function POST(request: NextRequest) {
    try {
        const { forumId, postUrl } = await request.json();

        if (!forumId || !postUrl) {
            return NextResponse.json(
                { success: false, error: 'forumId y postUrl son requeridos' },
                { status: 400 }
            );
        }

        // Verify forum exists
        const forum = await db.forum.findUnique({
            where: { id: forumId },
        });

        if (!forum) {
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        // Use the shared link extraction function
        const result = await extractLinksFromPostWithThankClick(forumId, postUrl);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || 'Error al extraer enlaces' },
                { status: 500 }
            );
        }

        // Convert ExtractedLinkInfo[] to the format expected by the testing UI
        const formattedLinks = result.links.map(link => ({
            url: link.url,
            hosting: link.hosting,
            filename: link.filename,
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
