import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

type SabnzbdJson = Record<string, unknown>;

function jsonResponse(payload: SabnzbdJson, status = 200) {
    return NextResponse.json(payload, { status });
}

function extractMeta(xml: string, metaType: string): string | null {
    // Minimal and tolerant: <meta type="guid">...</meta>
    const re = new RegExp(`<meta\\s+type=["']${metaType}["']\\s*>([\\s\\S]*?)<\\/meta>`, 'i');
    const match = xml.match(re);
    if (!match) return null;
    return match[1]?.trim() ?? null;
}

function parseCategories(value: string | null | undefined): string[] {
    const raw = (value ?? '').trim();
    if (!raw) return [];
    return raw
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
}

function buildSabCategories(categoryNames: string[]) {
    // Keep a SAB-like structure; Sonarr mainly cares that the configured category exists.
    return categoryNames.map((name) => ({
        name,
        pp: 3,
        script: 'None',
        dir: '',
        priority: 0,
    }));
}

function buildSabCategoryNames(categoryNames: string[]) {
    // Some *arr clients expect a plain list of category names from `mode=get_cats`.
    return categoryNames;
}

function buildQueueSlot(d: {
    id: string;
    title: string;
    status: string;
    progress: number;
    category: string | null;
}) {
    // Keep this close to SABnzbd's queue slot shape so *arr clients can parse it reliably.
    const percentage = Math.max(0, Math.min(100, Number(d.progress ?? 0)));
    return {
        index: 0,
        nzo_id: d.id,
        filename: d.title,
        nzb_name: d.title,
        status: d.status === 'completed' ? 'Completed' : 'Downloading',
        percentage,
        cat: d.category ?? '',
        script: 'None',
        priority: 0,
        // Sizes are unknown for DDL grabs; keep numeric strings to match SAB conventions.
        mb: '0.00',
        mbleft: '0.00',
        size: '0.00',
        sizeleft: '0.00',
        timeleft: '0:00:00',
        path: '',
    };
}

async function validateApiKey(apiKey: string | null) {
    if (!apiKey) return null;
    const exact = await db.forum.findFirst({ where: { torznabApiKey: apiKey, enabled: true } });
    if (exact) return exact;

    // Backwards/UX tolerance: some UIs copy/paste the key without the "fdd-" prefix.
    if (!apiKey.startsWith('fdd-')) {
        const withPrefix = `fdd-${apiKey}`;
        return db.forum.findFirst({ where: { torznabApiKey: withPrefix, enabled: true } });
    }

    return null;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') || '').toLowerCase();
    const output = (searchParams.get('output') || 'json').toLowerCase();
    const apiKey = searchParams.get('apikey') || searchParams.get('api_key');
    const section = (searchParams.get('section') || '').toLowerCase();

    logger.debug('sabnzbd', 'SABnzbd GET', {
        mode,
        output,
        hasApiKey: Boolean(apiKey),
        section,
        path: request.nextUrl.pathname,
    });

    // We only support JSON output for now.
    if (output !== 'json') {
        return jsonResponse({ status: false, error: 'Only output=json is supported' }, 400);
    }

    const forum = await validateApiKey(apiKey);
    if (!forum) {
        return jsonResponse({ status: false, error: 'Invalid API key' }, 401);
    }

    logger.debug('sabnzbd', 'SABnzbd forum resolved', {
        forumId: (forum as { id: string }).id,
        forumName: (forum as { name: string }).name,
        sabnzbdCategory: (forum as { sabnzbdCategory?: string | null }).sabnzbdCategory ?? null,
    });

    // Minimal subset used by Sonarr/Radarr for testing and basic queue integration.
    switch (mode) {
        case 'get_config':
            // Sonarr/Radarr use this in "Test".
            {
                const categoryNames = parseCategories(
                    (forum as { sabnzbdCategory?: string | null }).sabnzbdCategory
                );
                const effectiveNames = categoryNames.length > 0 ? categoryNames : ['tv'];

                // Some clients request get_config with section=categories.
                if (section === 'categories') {
                    return jsonResponse({
                        status: true,
                        config: {
                            categories: buildSabCategories(effectiveNames),
                        },
                    });
                }

                return jsonResponse({
                    status: true,
                    config: {
                        categories: buildSabCategories(effectiveNames),
                        misc: {
                            // SAB-style naming
                            api_key: apiKey,
                            // Keep these as placeholders; Sweaterr does not implement SAB features.
                            url_base: '',
                            enable_https: 0,
                        },
                    },
                });
            }

        case 'version':
            return jsonResponse({ status: true, version: '3.0.0', commithash: 'sweaterr' });

        case 'auth':
            return jsonResponse({ status: true, authenticated: true });

        case 'fullstatus': {
            // Sonarr/Radarr use this in "Test" with skip_dashboard=1.
            const categoryNames = parseCategories(
                (forum as { sabnzbdCategory?: string | null }).sabnzbdCategory
            );
            const effectiveNames = categoryNames.length > 0 ? categoryNames : ['tv'];

            const active = await db.download.findMany({
                where: {
                    forumName: (forum as { name: string }).name,
                    status: { in: ['downloading', 'queued'] },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });

            const slots = active.map((d) =>
                buildQueueSlot({
                    id: d.id,
                    title: d.title,
                    status: d.status,
                    progress: d.progress ?? 0,
                    category: d.category ?? null,
                })
            );

            // IMPORTANT: In SABnzbd's fullstatus, `status` is an object (not a boolean).
            // Sonarr expects to deserialize it as a structured object.
            return jsonResponse({
                version: '3.0.0',
                status: {
                    paused: false,
                    pause_int: 0,
                    have_warnings: 0,
                    have_errors: 0,
                    speedlimit: '0',
                    // Keep values present but neutral; Sweaterr is not a real SAB instance.
                    diskspace1: '0',
                    diskspace2: '0',
                    uptime: '0',
                    last_warning: '',
                    last_error: '',
                },
                queue: {
                    status: 'Downloading',
                    paused: false,
                    noofslots: slots.length,
                    slots,
                },
                warnings: [],
                categories: buildSabCategoryNames(effectiveNames),
                scripts: [],
                servers: [],
            });
        }

        case 'get_cats': {
            const categoryNames = parseCategories(
                (forum as { sabnzbdCategory?: string | null }).sabnzbdCategory
            );
            const effectiveNames = categoryNames.length > 0 ? categoryNames : ['tv'];
            return jsonResponse({
                status: true,
                categories: buildSabCategoryNames(effectiveNames),
            });
        }

        case 'queue': {
            const active = await db.download.findMany({
                where: {
                    forumName: (forum as { name: string }).name,
                    status: { in: ['downloading', 'queued'] },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });

            const slots = active.map((d) =>
                buildQueueSlot({
                    id: d.id,
                    title: d.title,
                    status: d.status,
                    progress: d.progress ?? 0,
                    category: d.category ?? null,
                })
            );

            return jsonResponse({
                status: true,
                queue: {
                    status: 'Downloading',
                    paused: false,
                    noofslots: slots.length,
                    slots,
                },
            });
        }

        case 'history': {
            const completed = await db.download.findMany({
                where: {
                    forumName: (forum as { name: string }).name,
                    status: { in: ['completed', 'failed'] },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });

            const slots = completed.map((d) => ({
                nzo_id: d.id,
                name: d.title,
                status: d.status === 'failed' ? 'Failed' : 'Completed',
                // SAB history commonly has "completed" timestamp; we expose ISO.
                completed: d.updatedAt?.toISOString?.() ?? null,
                // Placeholder; real size/path can be added later.
                size: '0 B',
                path: '',
            }));

            return jsonResponse({
                status: true,
                history: {
                    noofslots: slots.length,
                    slots,
                },
            });
        }

        // Pause/resume endpoints exist in SAB; keep them as no-ops for now.
        case 'pause':
        case 'resume':
            return jsonResponse({ status: true });

        default:
            logger.warn('sabnzbd', `SABnzbd unsupported mode: ${mode}`);
            return jsonResponse({ status: false, error: `Unsupported mode: ${mode}` }, 400);
    }
}

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') || '').toLowerCase();
    const output = (searchParams.get('output') || 'json').toLowerCase();
    const apiKey = searchParams.get('apikey') || searchParams.get('api_key');
    const cat = searchParams.get('cat');

    logger.debug('sabnzbd', 'SABnzbd POST', {
        mode,
        output,
        hasApiKey: Boolean(apiKey),
        cat,
        path: request.nextUrl.pathname,
        contentType: request.headers.get('content-type'),
    });

    if (output !== 'json') {
        return jsonResponse({ status: false, error: 'Only output=json is supported' }, 400);
    }

    const forum = await validateApiKey(apiKey);
    if (!forum) {
        return jsonResponse({ status: false, error: 'Invalid API key' }, 401);
    }

    if (cat) {
        const categoryNames = parseCategories(
            (forum as { sabnzbdCategory?: string | null }).sabnzbdCategory
        );
        const effectiveNames = categoryNames.length > 0 ? categoryNames : ['tv'];
        if (!effectiveNames.includes(cat)) {
            logger.warn('sabnzbd', 'SABnzbd category validation failed', {
                forumId: (forum as { id: string }).id,
                forumName: (forum as { name: string }).name,
                requestedCategory: cat,
                availableCategories: effectiveNames,
            });
            return jsonResponse(
                {
                    status: false,
                    error: 'Category does not exist',
                    availableCategories: effectiveNames,
                },
                400
            );
        }
    }

    // Sonarr/Radarr typically POST the NZB to mode=addfile.
    if (mode !== 'addfile') {
        return jsonResponse({ status: false, error: `Unsupported mode: ${mode}` }, 400);
    }

    let nzbText: string | null = null;
    const contentType = request.headers.get('content-type') || '';

    logger.info('sabnzbd', `POST addfile: contentType="${contentType}", bodyUsed=${request.bodyUsed}`);

    // IMPORTANT: Read raw body first before parsing - this preserves the stream for parsing
    let bodyBuffer: Buffer;
    try {
        const arrayBuffer = await request.arrayBuffer();
        bodyBuffer = Buffer.from(arrayBuffer);
        logger.info('sabnzbd', `Raw body size: ${bodyBuffer.length} bytes`);
    } catch (e) {
        logger.error('sabnzbd', `Error reading body: ${e}`);
        return jsonResponse({ status: false, error: 'Could not read request body' }, 400);
    }

    // Try to parse based on content type
    if (contentType.includes('multipart/form-data')) {
        try {
            // Try to extract boundary and parse manually
            const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
            if (boundaryMatch) {
                const boundary = boundaryMatch[1];
                const bodyStr = bodyBuffer.toString('utf-8');

                // Look for the NZB content between boundaries
                // The NZB typically appears after the boundary and before the next boundary
                const parts = bodyStr.split(`--${boundary}`);
                logger.debug('sabnzbd', `Found ${parts.length} parts in multipart`);

                for (let i = 1; i < parts.length; i++) {
                    const part = parts[i];
                    if (part.includes('<?xml')) {
                        // Extract the actual NZB content (after headers, before next boundary)
                        const contentStart = part.indexOf('<?xml');
                        const contentEnd = part.indexOf('\r\n--');
                        if (contentStart !== -1) {
                            nzbText = part.substring(contentStart, contentEnd > -1 ? contentEnd : undefined).trim();
                            logger.info('sabnzbd', `Extracted NZB from multipart part ${i}, size: ${nzbText.length} bytes`);
                            break;
                        }
                    }
                }
            }

            if (!nzbText) {
                logger.warn('sabnzbd', 'Could not find NZB in multipart parts');
            }
        } catch (e) {
            logger.error('sabnzbd', `Error parsing multipart manually: ${e}`);
        }
    } else if (contentType.includes('application/x-nzb') || contentType.includes('application/octet-stream')) {
        // Raw NZB file
        nzbText = bodyBuffer.toString('utf-8');
        logger.debug('sabnzbd', `Using raw body as NZB, size: ${nzbText.length} bytes`);
    } else {
        // Unknown content type - try anyway
        const bodyStr = bodyBuffer.toString('utf-8');
        if (bodyStr.includes('<?xml') && bodyStr.includes('</nzb>')) {
            nzbText = bodyStr;
            logger.debug('sabnzbd', `Extracted NZB from body with unknown content type`);
        }
    }

    if (!nzbText) {
        logger.error('sabnzbd', `Could not extract NZB. Body size: ${bodyBuffer.length}, first 500 chars: ${bodyBuffer.toString('utf-8').substring(0, 500)}`);
        return jsonResponse({ status: false, error: 'Missing nzbfile' }, 400);
    }
    const guid = extractMeta(nzbText, 'guid');
    const downloadId = extractMeta(nzbText, 'downloadId');

    // Idempotency: in the current architecture, t=get already queued JD and created the DB record.
    // This endpoint exists so Sonarr can consider the NZB "accepted" by a download client.
    const downloadIdOrNull = downloadId && downloadId.length > 0 ? downloadId : null;
    const guidOrNull = guid && guid.length > 0 ? guid : null;

    let download: { id: string } | null = null;
    if (downloadIdOrNull) {
        download = await db.download.findUnique({ where: { id: downloadIdOrNull }, select: { id: true } });
    }
    if (!download && guidOrNull) {
        download = await db.download.findFirst({ where: { grabId: guidOrNull }, select: { id: true } });
    }

    if (!download) {
        // We intentionally do not re-trigger grabbing here yet to avoid changing the working flow.
        // Once validated end-to-end, we can optionally move the actual JD enqueue into this endpoint.
        return jsonResponse({
            status: false,
            error:
                'Download not found for this NZB. Ensure the indexer grab (t=get) is reachable and working.',
        });
    }

    // Best-effort: attach category from the addfile request so queue slots expose it to Sonarr.
    if (cat && cat.length > 0) {
        try {
            await db.download.update({ where: { id: download.id }, data: { category: cat } });
        } catch {
            // Non-fatal
        }
    }

    logger.info('sabnzbd', 'SABnzbd addfile accepted', {
        forumId: (forum as { id: string }).id,
        forumName: (forum as { name: string }).name,
        cat: cat ?? null,
        resolvedDownloadId: download.id,
    });

    return jsonResponse({
        status: true,
        // Some clients read `nzo_id` (single) while others read `nzo_ids` (list).
        nzo_id: download.id,
        nzo_ids: [download.id],
    });
}
