import { NextRequest, NextResponse } from 'next/server';
import { FlareSolverrClient } from '@/lib/services/flaresolverr-client';

export async function POST(request: NextRequest) {
    try {
        const { query } = await request.json();
        const cseId = '44f04a516a5b84434';
        const cseUrl = `https://cse.google.com/cse?cx=${cseId}&q=${encodeURIComponent(query)}`;
        const flaresolverrUrl = process.env.FLARESOLVERR_URL;

        if (!flaresolverrUrl) {
            return NextResponse.json({ error: 'FlareSolverr no configurado' }, { status: 500 });
        }

        const client = new FlareSolverrClient(flaresolverrUrl);
        const solution = await client.request(cseUrl, 'GET');
        const html = solution.response || '';

        // Buscar todos los showthread
        const showthreadRe = /<a[^>]*href=["']([^"']*showthread[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
        const results: Array<{ url: string; title: string }> = [];
        let m: RegExpExecArray | null;
        while ((m = showthreadRe.exec(html)) !== null) {
            const titleRaw = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            results.push({ url: m[1], title: titleRaw });
        }

        return NextResponse.json({
            cseUrl,
            htmlLength: html.length,
            showthreadCount: results.length,
            showthreads: results,
        });
    } catch (error) {
        console.error('[Debug] Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
