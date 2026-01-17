import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const userAgent = request.headers.get('user-agent');
    const version = '2.8.3';
    
    console.log(`[qBittorrent] GET /api/v2/app/webapiVersion from ${userAgent || 'unknown'}`);
    console.log(`[qBittorrent] Returning version: "${version}"`);
    
    // Return plain text only - no JSON, no charset encoding
    const response = new NextResponse(version, {
        status: 200,
        headers: { 
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
        },
    });
    
    console.log(`[qBittorrent] Response status: ${response.status}, content-type: text/plain`);
    return response;
}
