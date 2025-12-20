import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
    try {
        const { forumId, postUrl } = await request.json();

        if (!forumId || !postUrl) {
            return NextResponse.json(
                { success: false, error: 'forumId y postUrl son requeridos' },
                { status: 400 }
            );
        }

        const forum = await db.forum.findUnique({ where: { id: forumId } });
        if (!forum) {
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        const flaresolverrUrl = process.env.FLARESOLVERR_URL;
        if (!flaresolverrUrl) {
            return NextResponse.json(
                { success: false, error: 'FlareSolverr no configurado' },
                { status: 500 }
            );
        }

        const client = new FlareSolverrClient(flaresolverrUrl);
        const solution = await client.request(postUrl, 'GET');
        const html = solution.response || '';
        const $ = cheerio.load(html);

        // Prefer configured selector; fallback to common headings
        const sel = forum.postTitleSelector || '.post-title, .topic-title, h1, h2';
        const title = $(sel).first().text().trim();

        return NextResponse.json({ success: true, title: title || null });
    } catch (error) {
        console.error('[Testing/Title] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener el título' },
            { status: 500 }
        );
    }
}
