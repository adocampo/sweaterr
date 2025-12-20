import { NextRequest, NextResponse } from 'next/server';

// GET /api/arr/indexer - Mock indexer for Sonarr/Radarr
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url || '');
    const query = searchParams.get('q') || '';

    // Return mock results
    const mockResults = [
      {
        title: `Mock Result for: ${query}`,
        guid: 'mock-1',
        size: 1073741824,
        quality: 'WEBDL-1080p',
        indexer: 'Blazarr',
        downloadUrl: '',
        seeders: 0,
        leechers: 0,
        protocol: 'direct',
        publishDate: new Date().toISOString(),
      }
    ];

    return NextResponse.json({
      success: true,
      data: mockResults,
    });
  } catch (error) {
    console.error('Error in indexer:', error);
    return NextResponse.json(
      { success: false, error: 'Indexer failed' },
      { status: 500 }
    );
  }
}