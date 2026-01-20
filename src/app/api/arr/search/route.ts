import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ForumService } from '@/lib/services/forum';
import { AIService } from '@/lib/services/ai';
import { logger } from '@/lib/logger';
import { detectType, extractSeason, extractSize, convertSizeToBytes, extractCleanTitle, getTvdbId, isSeasonPack } from '@/lib/metadata-extractor';

function getPublicOrigin(request: NextRequest): string {
    const forwardedProto = (request.headers.get('x-forwarded-proto') || '').split(',')[0]?.trim();
    const forwardedHost = (request.headers.get('x-forwarded-host') || '').split(',')[0]?.trim();
    const host = forwardedHost || request.headers.get('host');

    if (host) {
        return `${forwardedProto || 'http'}://${host}`;
    }

    return new URL(request.url).origin;
}

// Detect *arr service from User-Agent
function detectArrService(userAgent: string | null): string {
    if (!userAgent) return 'unknown';
    const ua = userAgent.toLowerCase();
    if (ua.includes('sonarr')) return 'sonarr';
    if (ua.includes('radarr')) return 'radarr';
    if (ua.includes('lidarr')) return 'lidarr';
    if (ua.includes('readarr')) return 'readarr';
    if (ua.includes('prowlarr')) return 'prowlarr';
    if (ua.includes('whisparr')) return 'whisparr';
    return 'unknown';
}

// GET /api/arr/search - Torznab search endpoint (simulated torrent indexer)
// Uses forum's API key (torznabApiKey field) for validation
// Returns Torznab-formatted XML with simulated seeders/peers/infohash/magneturl
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const origin = getPublicOrigin(request);
        const apiKey = searchParams.get('apikey') || request.headers.get('x-api-key');
        const userAgent = request.headers.get('user-agent');
        const service = detectArrService(userAgent);
        const t = searchParams.get('t'); // search type: search, tvsearch, movie
        const q = searchParams.get('q') || ''; // query
        const cats = (searchParams.get('cat') || '').split(',').filter(Boolean);
        const season = searchParams.get('season');
        const ep = searchParams.get('ep');
        const imdbid = searchParams.get('imdbid');
        const tmdbid = searchParams.get('tmdbid');
        const rawTitleOnly = searchParams.get('titleonly');
        const titleOnlyFromRequest = rawTitleOnly === '1' || rawTitleOnly === 'true';
        const hasTitleOnlyParam = rawTitleOnly !== null;

        logger.info('search', `[${service.toUpperCase()}] Search request: type=${t}, query="${q}", season=${season}, ep=${ep}, imdbid=${imdbid}, tmdbid=${tmdbid}, cats=${cats.join(',')}, titleonly=${hasTitleOnlyParam ? titleOnlyFromRequest : 'auto'}, apikey=${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);

        if (!apiKey) {
            logger.warn('search', `[${service.toUpperCase()}] Missing API key in request`);
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Validate API key against forum's torznabApiKey and load its config
        const forumWithApiKey = await db.forum.findUnique({
            where: { torznabApiKey: apiKey },
            include: { credentials: true },
        });

        logger.info('search', `[${service.toUpperCase()}] Forum lookup result: ${forumWithApiKey ? `Found forum '${forumWithApiKey.name}'` : 'NOT FOUND'}`);

        if (!forumWithApiKey || !forumWithApiKey.enabled) {
            logger.warn('search', `[${service.toUpperCase()}] Invalid API key or forum disabled. Forum: ${forumWithApiKey ? 'found but disabled' : 'not found'}`);
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // IMPORTANT: Each forum has its own API key. Only search the forum bound to this key.
        const forums = [forumWithApiKey];

        logger.info('search', `[${service.toUpperCase()}] Found ${forums.length} enabled forums to search in`);

        if (forums.length === 0) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>Sweaterr</title>
    <description>Direct download indexer</description>
        <link>${origin}</link>
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

        // Prepare forums for search; authenticate only when performing a real search
        // Avoid heavy auth when q is empty to keep placeholder responses fast for *arr

        // Build search query and TV variants (without AI)
        // If q is empty but we have season/ep, Sonarr sent minimal data; return placeholders
        let searchQuery = q;

        // Only attempt search if we have a query
        const shouldSearch = searchQuery && searchQuery.trim().length > 0;

        logger.info('search', `[${service.toUpperCase()}] shouldSearch=${shouldSearch}, q="${q}", season=${season}, ep=${ep}, isTvSearch=${t?.toLowerCase() === 'tvsearch'}`);

        // Prepare forums for search; authenticate only when performing a real search
        // Avoid heavy auth when q is empty to keep placeholder responses fast for *arr
        for (const forum of forums) {
            forumService.addForum({
                id: forum.id,
                name: forum.name,
                baseUrl: forum.baseUrl,
                searchPath: forum.searchPath,
                searchMode: (forum.searchMode as any) || undefined,
                searchForumLabel: forum.searchForumLabel || undefined,
                searchTitleOnly: forum.searchTitleOnly ?? true,
                searchInChildForums: forum.searchInChildForums ?? false,
                cseId: forum.cseId || undefined,
                persistentCookies: forum.persistentCookies || undefined,
                thankButtonSelector: forum.thankButtonSelector || undefined,
                linksContainerSelector: forum.linksContainerSelector || undefined,
                postTitleSelector: forum.postTitleSelector || undefined,
                credentials: forum.credentials ? {
                    username: forum.credentials.username,
                    password: forum.credentials.password,
                } : undefined,
            });

            // Authenticate only when we will actually search
            if (shouldSearch && forum.credentials) {
                await forumService.authenticate(forum.id);
            }
        }

        // Clean the series name by removing season/episode information that Sonarr may have injected
        // This ensures better results when Sonarr sends "Breaking Bad temporada 4" instead of just "Breaking Bad"
        const cleanSeriesName = (name: string): string => {
            if (!name) return '';
            // Remove common season/episode patterns: "temporada X", "season X", "T##", "S##E##", etc.
            return name
                .replace(/\s+(temporada|temporadas|season|seasons|serie|series|s\d+e\d+|s\d+|t\d+|cap\s*\d+|capítulo\s*\d+|chapter\s*\d+|ep\s*\d+|episodio\s*\d+).*$/i, '')
                .replace(/\s*[-–]\s*\d+x\d+.*$/i, '') // Remove "- 1x01" style
                .trim();
        };

        const buildTvVariants = (series: string, season?: string | null, ep?: string | null): string[] => {
            // First, clean the series name to remove any injected season/episode info
            const cleaned = cleanSeriesName(series);
            const s = season ? String(season).padStart(2, '0') : '';
            const e = ep ? String(ep).padStart(2, '0') : '';
            const v: string[] = [];

            // Always start with the cleaned series name as primary variant
            v.push(cleaned);

            // Then add formatted variants if we have season/episode info
            if (s && e) {
                v.push(`${cleaned} ${s}x${e}`);
                v.push(`${cleaned} S${s}E${e}`);
                v.push(`${cleaned} temporada ${parseInt(s, 10)}`);
                v.push(`${cleaned} T${parseInt(s, 10)}`);
                v.push(`${cleaned} episodio ${parseInt(e, 10)}`);
                v.push(`${cleaned} cap ${parseInt(e, 10)}`);
            } else if (s) {
                v.push(`${cleaned} temporada ${parseInt(s, 10)}`);
                v.push(`${cleaned} T${parseInt(s, 10)}`);
                v.push(`${cleaned} S${s}`);
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
        const primaryCategory = cats[0] || '5000'; // Default to TV, actual category determined by service
        const requestedCategories = (cats.length > 0 ? Array.from(new Set(cats)) : [primaryCategory]).slice(0, 10);

        if (shouldSearch) {
            const isTv = (t || '').toLowerCase() === 'tvsearch';
            const variants = isTv ? buildTvVariants(searchQuery, season, ep) : [searchQuery];

            logger.info('search', `[${service.toUpperCase()}] Starting forum search for query: "${searchQuery}" (variants: ${variants.length})`);

            for (const forum of forums) {
                try {
                    let found = false;
                    for (const vq of variants) {
                        const effectiveTitleOnly = hasTitleOnlyParam
                            ? titleOnlyFromRequest
                            : (forum.searchTitleOnly ?? (forum.searchMode === 'native'));

                        logger.info('search', `[${service.toUpperCase()}] Searching in forum "${forum.name}" with variant: "${vq}"${effectiveTitleOnly ? ' (titleonly)' : ''}`);
                        const results = await forumService.search(forum.id, vq, { titleOnly: effectiveTitleOnly, fetchAll: true, maxPages: 20 });
                        if (results.length > 0) {
                            logger.info('search', `[${service.toUpperCase()}] Found ${results.length} results in forum "${forum.name}"`);
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
                        logger.warn('search', `[${service.toUpperCase()}] No results found in forum "${forum.name}" for any variant`);
                        // no-op; fallback handled below
                    }
                } catch (error) {
                    logger.error('search', `[${service.toUpperCase()}] Search failed for forum ${forum.name}: ${error}`);
                    console.error(`Search failed for forum ${forum.name}:`, error);
                }
            }

            // If all searches failed or returned nothing, emit placeholders so *arr receives items instead of empty results.
            // NOTE: When performing a real search (q provided), return an empty RSS feed if there are no matches.
            // Placeholder items cause confusing behavior in *arr (they look like real releases but cannot be grabbed).
        } else {
            // Recent mode: return lightweight placeholders tagged with the requested categories.
            const placeholderForums = forums.slice(0, Math.max(1, 3));
            const placeholderCount = Math.max(3, requestedCategories.length || 1);

            for (let i = 0; i < placeholderCount; i++) {
                const cat = requestedCategories.length > 0 ? requestedCategories[i % requestedCategories.length] : primaryCategory;
                const forum = placeholderForums[i % placeholderForums.length];
                allResults.push({
                    title: `[Recent] ${forum.name}`,
                    url: forum.baseUrl,
                    snippet: 'Placeholder; run interactive search with a query for real results.',
                    forumId: forum.id,
                    forumName: forum.name,
                    category: cat || primaryCategory,
                    size: 1024,
                });
            }

            if (allResults.length === 0) {
                allResults.push({
                    title: '[Recent] Sweaterr placeholder',
                    url: origin,
                    snippet: 'No forums enabled; add a query to search.',
                    forumId: 'placeholder',
                    forumName: 'Sweaterr',
                    category: primaryCategory,
                    size: 1024,
                });
            }
        }

        // Filter results by content type and season for TV searches
        let filteredResults = allResults;
        const isTvSearch = t?.toLowerCase() === 'tvsearch';
        
        if (shouldSearch && isTvSearch) {
            const beforeTypeFilter = filteredResults.length;
            
            // First, filter by content type (only series for TV searches)
            filteredResults = allResults.filter(result => {
                const contentType = detectType(result.title, '');
                // Only include series for TV searches, exclude 'unknown' and 'movie'
                return contentType === 'series';
            });
            
            const afterTypeFilter = filteredResults.length;
            logger.info('search', `[${service.toUpperCase()}] Type filter (series only): ${beforeTypeFilter} results → ${afterTypeFilter} results (removed ${beforeTypeFilter - afterTypeFilter} non-series)`);
            
            // Then, filter by season if specified
            if (season) {
                const requestedSeason = parseInt(season, 10);
                const beforeSeasonFilter = filteredResults.length;
                
                filteredResults = filteredResults.filter(result => {
                    const detectedSeason = extractSeason(result.title);
                    const resultIsSeasonPack = isSeasonPack(result.title);
                    
                    // Include result if:
                    // 1. It's a season pack for the requested season, OR
                    // 2. Season matches exactly, OR
                    // 3. Cannot detect season (keep ambiguous results)
                    return (resultIsSeasonPack && detectedSeason === requestedSeason) || 
                           detectedSeason === null || 
                           detectedSeason === requestedSeason;
                });
                
                const afterSeasonFilter = filteredResults.length;
                logger.info('search', `[${service.toUpperCase()}] Season filter (S${requestedSeason}): ${beforeSeasonFilter} results → ${afterSeasonFilter} results (removed ${beforeSeasonFilter - afterSeasonFilter})`);
            }
        }

        // Rank results with AI if available
        let rankedResults = filteredResults;
        if (aiService && filteredResults.length > 0) {
            // TODO: Use AI to rank results
            // For now, keep original order
        }

        // Get TVDB ID from first result's clean title (only for TV searches)
        let tvdbId: number | null = null;
        if (t === 'tvsearch' && rankedResults.length > 0) {
            try {
                const firstResultCleanTitle = extractCleanTitle(rankedResults[0].title);
                logger.info('search', `[${service.toUpperCase()}] First result title: "${rankedResults[0].title}" → clean: "${firstResultCleanTitle}"`);
                
                if (firstResultCleanTitle && firstResultCleanTitle.trim().length > 0) {
                    tvdbId = await getTvdbId(firstResultCleanTitle.trim());
                    logger.info('search', `[${service.toUpperCase()}] TVDB lookup for "${firstResultCleanTitle}": ${tvdbId ? `Found ID ${tvdbId}` : 'Not found'}`);
                } else {
                    logger.warn('search', `[${service.toUpperCase()}] Could not extract clean title from first result`);
                }
            } catch (err) {
                logger.warn('search', `[${service.toUpperCase()}] Failed to get TVDB ID: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // Convert to Torznab XML format (simulated torrent with seeders/peers/infohash/magneturi)
        const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Generate simulated torrent values (deterministic based on URL for consistency)
        const generateSimulatedTorrentData = (url: string, size: number) => {
            const hashInput = url + size.toString();
            let hash = 0;
            for (let i = 0; i < hashInput.length; i++) {
                hash = ((hash << 5) - hash) + hashInput.charCodeAt(i);
                hash = hash & hash; // Convert to 32bit integer
            }
            const seeders = Math.abs(hash % 100) + 50; // 50-149 seeders
            const peers = Math.abs((hash >> 8) % 50) + 10; // 10-59 peers
            const infohash = Math.abs(hash).toString(16).padStart(40, '0').substring(0, 40);
            return { seeders, peers, infohash };
        };

        const selfLink = `${origin}${request.nextUrl.pathname}${request.nextUrl.search}`;

        const items = rankedResults.map((result, idx) => {
            // Extract quality hints from title
            let category = result.category || '7000'; // Other by default
            if (!result.category) {
                // Determine category based on detected service
                if (service === 'sonarr') category = '5000'; // TV
                if (service === 'radarr') category = '2000'; // Movies
                if (service === 'lidarr') category = '3000'; // Audio
            }

            // Encode GUID as base64 to avoid parsing issues with URLs containing special chars
            const guidData = JSON.stringify({
                forumId: result.forumId,
                category,
                url: result.url,
                title: result.title,
            });
            const guid = Buffer.from(guidData).toString('base64url');
            const pubDate = new Date().toUTCString();

            // Extract size from title, fallback to result.size or default
            const sizeString = result.size ? String(result.size) : extractSize(result.title);
            const size = sizeString ? convertSizeToBytes(sizeString) : 200 * 1048576; // Default 200 MiB
            // Use standard Torznab download pattern: /api/arr?t=get&id=<guid>&apikey=<apiKey>
            const enclosureUrl = `${origin}/api/arr?t=get&id=${encodeURIComponent(guid)}&apikey=${apiKey}`;
            const escapedLink = escapeXml(enclosureUrl);
            
            // Generate simulated torrent metadata
            const torrentData = generateSimulatedTorrentData(result.url, size);
            // Include the original forum link in the magnet URI as a custom parameter
            // so qBittorrent API can extract it and send to JDownloader
            const magnetUri = `magnet:?xt=urn:btih:${torrentData.infohash}&dn=${encodeURIComponent(result.title)}&xs=${encodeURIComponent(result.url)}`;
            const escapedMagnetUri = escapeXml(magnetUri);
            
            const escapedTitle = escapeXml(result.title);
            const escapedDescription = escapeXml(`${result.forum ?? result.forumName ?? 'Sweaterr'} - ${result.url}`);
            
            // Detect if this is a season pack
            const resultIsSeasonPack = isSeasonPack(result.title);
            const detectedSeason = resultIsSeasonPack ? extractSeason(result.title) : null;
            
            // Log season pack detection for first result only
            if (idx === 0 && resultIsSeasonPack) {
                logger.info('search', `[${service.toUpperCase()}] Season pack detected: "${result.title}" (Season ${detectedSeason})`);
            }

            return `    <item>
            <title>${escapedTitle}</title>
            <guid isPermaLink="false">${guid}</guid>
            <link>${escapedLink}</link>
            <pubDate>${pubDate}</pubDate>
            <category>${category}</category>
            <description>${escapedDescription}</description>
            <enclosure url="${escapedLink}" length="${size}" type="application/x-bittorrent"/>
            <torznab:attr name="category" value="${category}"/>
            <torznab:attr name="size" value="${size}"/>
            <torznab:attr name="seeders" value="${torrentData.seeders}"/>
            <torznab:attr name="peers" value="${torrentData.peers}"/>
            <torznab:attr name="infohash" value="${torrentData.infohash}"/>${tvdbId ? `\n            <torznab:attr name="tvdbid" value="${tvdbId}"/>` : ''}${resultIsSeasonPack && detectedSeason ? `\n            <torznab:attr name="season" value="${detectedSeason}"/>` : ''}
            <torznab:attr name="magneturl" value="${escapedMagnetUri}"/>
            <torznab:attr name="grabs" value="${Math.floor(torrentData.seeders * 2.5)}"/>
        </item>`;
        }).join('\n');

        const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>Sweaterr</title>
    <description>Direct download torrent indexer</description>
        <link>${origin}</link>
    <language>es-es</language>
    <webMaster>admin@sweaterr.local</webMaster>
        <atom:link rel="self" href="${escapeXml(selfLink)}" type="application/rss+xml" />
        <torznab:response offset="0" total="${rankedResults.length}" />
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

        logger.info('search', `[${service.toUpperCase()}] Returning XML response with ${rankedResults.length} items (${rssXml.length} bytes)`);
        logger.info('search', `[${service.toUpperCase()}] XML preview: ${rssXml.substring(0, 500)}...`);

        return new NextResponse(rssXml, {
            headers: { 'Content-Type': 'application/rss+xml' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        logger.error('search', `Error in search endpoint: ${errorMessage}`, errorStack);
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
