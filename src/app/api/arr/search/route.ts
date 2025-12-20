import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ForumService } from '@/lib/services/forum';
import { AIService } from '@/lib/services/ai';

// GET /api/arr/search - Newznab/Torznab search endpoint
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const apiKey = searchParams.get('apikey') || request.headers.get('x-api-key');
        const t = searchParams.get('t'); // search type: search, tvsearch, movie
        const q = searchParams.get('q') || ''; // query
        const season = searchParams.get('season');
        const ep = searchParams.get('ep');
        const imdbid = searchParams.get('imdbid');
        const tmdbid = searchParams.get('tmdbid');

        if (!apiKey) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Validate API key
        const service = await db.arrService.findUnique({
            where: { apiKey },
        });

        if (!service || !service.enabled) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Get enabled forums
        const forums = await db.forum.findMany({
            where: { enabled: true },
            include: { credentials: true },
        });

        if (forums.length === 0) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:newznab="http://www.newznab.com/DTD/2010/feeds/attributes/">
  <channel>
    <title>Forum Downloader</title>
    <description>Direct download indexer</description>
    <link>${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}</link>
    <language>es-es</language>
    <webMaster>admin@forumdownloader.local</webMaster>
  </channel>
</rss>`,
                {
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Initialize services
        const forumService = new ForumService();
        const aiConfig = await db.aIConfig.findFirst({ where: { enabled: true } });
        let aiService: AIService | null = null;

        if (aiConfig) {
            aiService = new AIService({
                provider: aiConfig.provider,
                apiKey: aiConfig.apiKey || undefined,
                baseUrl: aiConfig.baseUrl || undefined,
                model: aiConfig.model || undefined,
            });
        }

        // Add forums to service
        for (const forum of forums) {
            forumService.addForum({
                id: forum.id,
                name: forum.name,
                baseUrl: forum.baseUrl,
                searchPath: forum.searchPath,
                thankButtonSelector: forum.thankButtonSelector || undefined,
                linksContainerSelector: forum.linksContainerSelector || undefined,
                postTitleSelector: forum.postTitleSelector || undefined,
                credentials: forum.credentials ? {
                    username: forum.credentials.username,
                    password: forum.credentials.password,
                } : undefined,
            });

            // Authenticate if needed
            if (forum.credentials) {
                await forumService.authenticate(forum.id);
            }
        }

        // Build search query (AI can help map pretty names to forum search terms)
        let searchQuery = q;
        if (aiService && q) {
            // TODO: Use AI to enhance search query
            // For now, use raw query
        }

        // Search all forums
        const allResults: any[] = [];
        for (const forum of forums) {
            try {
                const results = await forumService.search(forum.id, searchQuery);
                allResults.push(...results.map(r => ({
                    ...r,
                    forumId: forum.id,
                    forumName: forum.name,
                })));
            } catch (error) {
                console.error(`Search failed for forum ${forum.name}:`, error);
            }
        }

        // Rank results with AI if available
        let rankedResults = allResults;
        if (aiService && allResults.length > 0) {
            // TODO: Use AI to rank results
            // For now, keep original order
        }

        // Convert to Newznab XML format
        const items = rankedResults.map((result, idx) => {
            const guid = `${result.forumId}-${result.url}`;
            const pubDate = new Date().toUTCString();

            // Extract quality hints from title
            let category = '7000'; // Other by default
            if (service.type === 'sonarr') category = '5000'; // TV
            if (service.type === 'radarr') category = '2000'; // Movies
            if (service.type === 'lidarr') category = '3000'; // Audio

            return `    <item>
      <title><![CDATA[${result.title}]]></title>
      <guid>${guid}</guid>
      <link>${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/arr/grab?guid=${encodeURIComponent(guid)}&amp;apikey=${apiKey}</link>
      <pubDate>${pubDate}</pubDate>
      <category>${category}</category>
      <description><![CDATA[${result.forum} - ${result.url}]]></description>
      <enclosure url="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/arr/grab?guid=${encodeURIComponent(guid)}&amp;apikey=${apiKey}" length="0" type="application/x-nzb"/>
      <newznab:attr name="category" value="${category}"/>
      <newznab:attr name="size" value="0"/>
      <newznab:attr name="guid" value="${guid}"/>
    </item>`;
        }).join('\n');

        const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:newznab="http://www.newznab.com/DTD/2010/feeds/attributes/">
  <channel>
    <title>Forum Downloader</title>
    <description>Direct download indexer</description>
    <link>${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}</link>
    <language>es-es</language>
    <webMaster>admin@forumdownloader.local</webMaster>
${items}
  </channel>
</rss>`;

        // Save search history
        await db.searchHistory.create({
            data: {
                query: searchQuery,
                forumName: forums.map(f => f.name).join(', '),
                resultCount: rankedResults.length,
                success: true,
            },
        });

        return new NextResponse(rssXml, {
            headers: { 'Content-Type': 'application/xml' },
        });
    } catch (error) {
        console.error('Error in search endpoint:', error);
        return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?>
<error code="900" description="Internal server error"/>`,
            {
                status: 500,
                headers: { 'Content-Type': 'application/xml' },
            }
        );
    }
}
