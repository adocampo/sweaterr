import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const tmdbCheckSchema = z.object({
    apiKey: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
    try {
        const { apiKey } = tmdbCheckSchema.parse(await request.json());
        const headers: Record<string, string> = { Accept: 'application/json' };
        const params = new URLSearchParams();

        if (apiKey.split('.').length === 3) {
            headers.Authorization = `Bearer ${apiKey}`;
        } else {
            params.set('api_key', apiKey);
        }

        const response = await fetch(`https://api.themoviedb.org/3/configuration?${params}`, {
            headers,
            signal: AbortSignal.timeout(10000),
        });

        return NextResponse.json({ success: response.ok });
    } catch (error) {
        console.error('Error testing TMDB config:', error);
        return NextResponse.json({ success: false }, { status: 400 });
    }
}
