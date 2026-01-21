import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import crypto from 'node:crypto';

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

function isHexInfoHash(value: string): boolean {
    return /^[a-f0-9]{40}$/.test(value);
}

function stableHashHex(input: string): string {
    return crypto.createHash('sha1').update(Buffer.from(input, 'utf8')).digest('hex');
}

function normalizeProgress(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function mapState(status: string | null | undefined): string {
    const s = (status || '').toLowerCase();
    if (s.includes('pause')) return 'pausedDL';
    if (s.includes('complete') || s.includes('finished')) return 'uploading';
    if (s.includes('fail')) return 'error';
    if (s.includes('download')) return 'downloading';
    return 'queuedDL';
}

/**
 * GET /api/qbittorrent/api/v2/torrents/info
 * Returns information about torrents
 * This is a mock endpoint that returns an empty list
 */
export async function GET(request: NextRequest) {
    const caller = detectArrService(request.headers.get('user-agent'));
    logger.info('qbittorrent', `GET /api/v2/torrents/info caller=${caller}`);

    // qBittorrent API supports filtering with ?hashes=<hash>|all
    const { searchParams } = new URL(request.url);
    const hashes = searchParams.get('hashes');
    const filterAll = !hashes || hashes === 'all';
    const requested = !filterAll
        ? new Set(hashes.split('|').map((h) => h.trim().toLowerCase()).filter(Boolean))
        : null;

    // If Sonarr requests specific hashes, ensure we return one entry per hash.
    // Sonarr uses this endpoint to populate Activity; returning [] makes items disappear.
    if (requested && requested.size > 0) {
        const requestedList = Array.from(requested);
        const existing = await db.download.findMany({
            where: {
                grabId: { in: requestedList },
            },
            orderBy: { updatedAt: 'desc' },
        });

        const byHash = new Map<string, (typeof existing)[number]>();
        for (const row of existing) {
            const h = (row.grabId || '').toLowerCase();
            if (h && !byHash.has(h)) byHash.set(h, row);
        }

        const now = new Date();

        const torrents = await Promise.all(
            requestedList.map(async (hash) => {
                const normalized = isHexInfoHash(hash) ? hash : stableHashHex(hash);
                let row = byHash.get(normalized);

                // Create a placeholder record if we don't have one yet.
                if (!row) {
                    try {
                        row = await db.download.create({
                            data: {
                                title: `Sweaterr download ${normalized.substring(0, 8)}`,
                                sourceUrl: '',
                                forumName: 'Sweaterr qBittorrent API',
                                status: 'downloading',
                                progress: 0,
                                arrType: caller !== 'unknown' ? caller : 'sonarr',
                                grabId: normalized,
                                category: 'tv-sonarr',
                                releaseTitle: `Sweaterr download ${normalized.substring(0, 8)}`,
                                size: '0',
                                createdAt: now,
                                updatedAt: now,
                            },
                        });
                    } catch {
                        // Ignore; we'll still return a synthetic object.
                    }
                }

                const progress = normalizeProgress(row?.progress);
                const state = mapState(row?.status);

                return {
                    added_on: row ? Math.floor(new Date(row.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
                    amount_left: 0,
                    auto_tmm: false,
                    availability: 1,
                    category: row?.category || 'tv-sonarr',
                    completed: 0,
                    completion_on: state === 'uploading' && row ? Math.floor(new Date(row.updatedAt).getTime() / 1000) : 0,
                    content_path: '',
                    dl_limit: -1,
                    dlspeed: 0,
                    downloaded: 0,
                    downloaded_session: 0,
                    eta: 0,
                    f_l_piece_prio: false,
                    force_start: false,
                    hash: normalized,
                    infohash_v1: normalized,
                    last_activity: row ? Math.floor(new Date(row.updatedAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
                    magnet_uri: '',
                    name: row?.releaseTitle || row?.title || `Sweaterr download ${normalized.substring(0, 8)}`,
                    num_complete: 0,
                    num_incomplete: 0,
                    num_leechs: 0,
                    num_seeds: 0,
                    priority: 0,
                    progress,
                    ratio: 0,
                    save_path: '/downloads',
                    seeding_time: 0,
                    seeding_time_limit: -1,
                    seen_complete: 0,
                    seq_dl: false,
                    size: 0,
                    state,
                    super_seeding: false,
                    tags: '',
                    time_active: 0,
                    total_size: 0,
                    tracker: 'udp://tracker.sweaterr.local:6969',
                    up_limit: -1,
                    uploaded: 0,
                    uploaded_session: 0,
                    upspeed: 0,
                };
            })
        );

        return NextResponse.json(torrents);
    }

    const downloads = await db.download.findMany({
        where: {
            grabId: { not: null },
            arrType: { not: null },
            // Only items managed through the qBittorrent facade should be exposed as torrents.
            forumName: 'Sweaterr qBittorrent API',
            // Only expose active-ish items as torrents.
            NOT: [{ status: 'completed' }, { status: 'failed' }],
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
    });

    // Deduplicate by hash (Sonarr expects a single item per torrent hash)
    const seen = new Set<string>();

    const torrents = downloads
        .filter((d) => {
            const raw = (d.grabId || '').toString();
            const hash = isHexInfoHash(raw.toLowerCase()) ? raw.toLowerCase() : stableHashHex(raw || 'unknown');
            if (!hash) return false;
            if (requested && !requested.has(hash)) return false;
            if (seen.has(hash)) return false;
            seen.add(hash);
            return true;
        })
        .map((d) => {
            const raw = (d.grabId || '').toString();
            const hash = isHexInfoHash(raw.toLowerCase()) ? raw.toLowerCase() : stableHashHex(raw || 'unknown');
            const progress = normalizeProgress(d.progress);
            const state = mapState(d.status);

            // Opportunistic cleanup: persist normalized hash so future commands can target it.
            if (!isHexInfoHash(raw.toLowerCase()) && hash) {
                db.download.update({ where: { id: d.id }, data: { grabId: hash } }).catch(() => { });
            }

            return {
                added_on: Math.floor(new Date(d.createdAt).getTime() / 1000),
                amount_left: 0,
                auto_tmm: false,
                availability: 1,
                category: d.category || '',
                completed: 0,
                completion_on: state === 'uploading' ? Math.floor(new Date(d.updatedAt).getTime() / 1000) : 0,
                content_path: '',
                dl_limit: -1,
                dlspeed: 0,
                downloaded: 0,
                downloaded_session: 0,
                eta: 0,
                f_l_piece_prio: false,
                force_start: false,
                hash,
                infohash_v1: hash,
                last_activity: Math.floor(new Date(d.updatedAt).getTime() / 1000),
                magnet_uri: '',
                name: d.releaseTitle || d.title,
                num_complete: 0,
                num_incomplete: 0,
                num_leechs: 0,
                num_seeds: 0,
                priority: 0,
                progress,
                ratio: 0,
                save_path: '/downloads',
                seeding_time: 0,
                seeding_time_limit: -1,
                seen_complete: 0,
                seq_dl: false,
                size: 0,
                state,
                super_seeding: false,
                tags: '',
                time_active: 0,
                total_size: 0,
                tracker: 'udp://tracker.sweaterr.local:6969',
                up_limit: -1,
                uploaded: 0,
                uploaded_session: 0,
                upspeed: 0,
            };
        });

    return NextResponse.json(torrents);
}
