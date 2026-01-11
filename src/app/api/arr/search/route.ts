import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ForumService } from '@/lib/services/forum';
import { AIService } from '@/lib/services/ai';
import { logger } from '@/lib/logger';

// GET /api/arr/search - Newznab/Torznab search endpoint
// Uses forum's torznabApiKey for validation
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const apiKey = searchParams.get('apikey') || request.headers.get('x-api-key');
        const t = searchParams.get('t'); // search type: search, tvsearch, movie
        const q = searchParams.get('q') || ''; // query
        const cats = (searchParams.get('cat') || '').split(',').filter(Boolean);
        const season = searchParams.get('season');
        const ep = searchParams.get('ep');
        const imdbid = searchParams.get('imdbid');
        const tmdbid = searchParams.get('tmdbid');
        
        logger.info('ARR_SEARCH', `Search request: type=${t}, query="${q}", season=${season}, ep=${ep}, imdbid=${imdbid}, tmdbid=${tmdbid}, cats=${cats.join(',')}, apikey=${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);

        if (!apiKey) {
            logger.warn('ARR_SEARCH', 'Missing API key in request');
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Validate API key against forum's torznabApiKey
        const forumWithApiKey = await db.forum.findFirst({
            where: { torznabApiKey: apiKey },
        });
        
        logger.info('ARR_SEARCH', `Forum lookup result: ${forumWithApiKey ? `Found forum '${forumWithApiKey.name}'` : 'NOT FOUND'}`);

        if (!forumWithApiKey || !forumWithApiKey.enabled) {
            logger.warn('ARR_SEARCH', `Invalid API key or forum disabled. Forum: ${forumWithApiKey ? 'found but disabled' : 'not found'}`);
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Get enabled forums (all of them, since each has its own API key)
        const forums = await db.forum.findMany({
            where: { enabled: true },
            include: { credentials: true },
        });
        
        logger.info('ARR_SEARCH', `Found ${forums.length} enabled forums to search in`);

        if (forums.length === 0) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:newznab="http://www.newznab.com/DTD/2010/feeds/attributes/">
  <channel>
    <title>Sweaterr</title>
    <description>Direct download indexer</description>
    <link>${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}</link>
    <language>es-es</language>
    <webMaster>admin@sweaterr.local</webMaster>
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

        // Add forums and authenticate only when a real query is present
        if (q && q.trim().length > 0) {
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
        }

        // Build search query and TV variants (without AI)
        let searchQuery = q;
        const buildTvVariants = (series: string, season?: string | null, ep?: string | null): string[] => {
            const s = season ? String(season).padStart(2, '0') : '';
            const e = ep ? String(ep).padStart(2, '0') : '';
            const base = series.replace(/\s*-\s*\d+x\d+.*$/i, '').trim();
            const v: string[] = [];
            if (s && e) {
                v.push(`${base} ${s}x${e}`);
                v.push(`${base} S${s}E${e}`);
                v.push(`${base} temporada ${parseInt(s, 10)}`);
                v.push(`${base} T${parseInt(s, 10)}`);
                v.push(`${base} episodio ${parseInt(e, 10)}`);
                v.push(`${base} cap ${parseInt(e, 10)}`);
            } else if (s) {
                v.push(`${base} temporada ${parseInt(s, 10)}`);
                v.push(`${base} T${parseInt(s, 10)}`);
                v.push(`${base} S${s}`);
            } else {
                v.push(base);
            }
            // Ensure uniqueness and limit
            return Array.from(new Set(v)).slice(0, 8);
        };
        if (aiService && q) {
            // TODO: Use AI to enhance search query
            // For now, use raw query
        }

        // Search all forums (regular search when q present)
        const allResults: any[] = [];
        const primaryCategory = cats[0] || (service.type === 'sonarr' ? '5000' : service.type === 'radarr' ? '2000' : '3000');
        const requestedCategories = (cats.length > 0 ? Array.from(new Set(cats)) : [primaryCategory]).slice(0, 10);

        if (searchQuery && searchQuery.trim().length > 0) {
            const isTv = (t || '').toLowerCase() === 'tvsearch';
            const variants = isTv ? buildTvVariants(searchQuery, season, ep) : [searchQuery];

            for (const forum of forums) {
                try {
                    let found = false;
                    for (const vq of variants) {
                        const results = await forumService.search(forum.id, vq);
                        if (results.length > 0) {
                            allResults.push(...results.map(r => ({
                                ...r,
                                forumId: forum.id,
                                forumName: forum.name,
                            })));
                            found = true;
                            break; // Stop after first variant hits for this forum
                        }
                    }
                    if (!found) {
                        // no-op; fallback handled below
                    }
                } catch (error) {
                    console.error(`Search failed for forum ${forum.name}:`, error);
                }
            }

            // If all searches failed or returned nothing, emit placeholders so *arr receives items instead of empty results.
            if (allResults.length === 0) {
                const placeholderForums = forums.slice(0, Math.max(1, requestedCategories.length, 3));

                requestedCategories.forEach((cat, index) => {
                    const forum = placeholderForums[index % placeholderForums.length];
                    allResults.push({
                        title: `[Recent] ${forum.name}`,
                        url: forum.baseUrl,
                        snippet: 'Placeholder; run interactive search with a query for real results.',
                        forumId: forum.id,
                        forumName: forum.name,
                        category: cat || primaryCategory,
                        size: 1024,
                    });
                });
            }
        } else {
            // Recent mode: return lightweight placeholders tagged with the requested categories.
            const placeholderForums = forums.slice(0, Math.max(1, requestedCategories.length, 3));

            requestedCategories.forEach((cat, index) => {
                const forum = placeholderForums[index % placeholderForums.length];
                allResults.push({
                    title: `[Recent] ${forum.name}`,
                    url: forum.baseUrl,
                    snippet: 'Placeholder; run interactive search with a query for real results.',
                    forumId: forum.id,
                    forumName: forum.name,
                    category: cat || primaryCategory,
                    size: 1024,
                });
            });

            if (allResults.length === 0) {
                allResults.push({
                    title: '[Recent] Sweaterr placeholder',
                    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                    snippet: 'No forums enabled; add a query to search.',
                    forumId: 'placeholder',
                    forumName: 'Sweaterr',
                    category: primaryCategory,
                    size: 1024,
                });
            }
        }

        // Rank results with AI if available
        let rankedResults = allResults;
        if (aiService && allResults.length > 0) {
            // TODO: Use AI to rank results
            // For now, keep original order
        }

        // Convert to Newznab XML format
        const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const selfLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${request.nextUrl.pathname}${request.nextUrl.search}`;

        const items = rankedResults.map((result, idx) => {
            // Extract quality hints from title
            let category = result.category || '7000'; // Other by default
            if (!result.category) {
                if (service.type === 'sonarr') category = '5000'; // TV
                if (service.type === 'radarr') category = '2000'; // Movies
                if (service.type === 'lidarr') category = '3000'; // Audio
            }

            // Encode GUID as base64 to avoid parsing issues with URLs containing special chars
            const guidData = JSON.stringify({
                forumId: result.forumId,
                category,
                url: result.url,
            });
            const guid = Buffer.from(guidData).toString('base64url');
            const pubDate = new Date().toUTCString();

            const size = result.size || 1024;
            const enclosureUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/arr/grab?guid=${encodeURIComponent(guid)}&apikey=${apiKey}`;
            const escapedLink = escapeXml(enclosureUrl);

            return `    <item>
            <title><![CDATA[${result.title}]]></title>
            <guid isPermaLink="false">${guid}</guid>
            <link>${escapedLink}</link>
            <pubDate>${pubDate}</pubDate>
            <category>${category}</category>
            <description><![CDATA[${result.forum ?? result.forumName ?? 'Sweaterr'} - ${result.url}]]></description>
            <enclosure url="${escapedLink}" length="${size}" type="application/x-nzb"/>
            <torznab:attr name="category" value="${category}"/>
            <torznab:attr name="size" value="${size}"/>
            <torznab:attr name="guid" value="${guid}"/>
            <newznab:attr name="category" value="${category}"/>
            <newznab:attr name="size" value="${size}"/>
            <newznab:attr name="guid" value="${guid}"/>
        </item>`;
        }).join('\n');

        const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:newznab="http://www.newznab.com/DTD/2010/feeds/attributes/" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>Sweaterr</title>
    <description>Direct download indexer</description>
    <link>${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}</link>
    <language>es-es</language>
    <webMaster>admin@forumdownloader.local</webMaster>
        <atom:link rel="self" href="${escapeXml(selfLink)}" type="application/rss+xml" />
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
