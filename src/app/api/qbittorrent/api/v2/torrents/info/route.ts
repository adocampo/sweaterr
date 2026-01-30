import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { JDownloaderService } from '@/lib/services/jdownloader';
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
 * Syncs with JDownloader in real-time so Sonarr Activity shows current progress
 */
export async function GET(request: NextRequest) {
    const caller = detectArrService(request.headers.get('user-agent'));
    logger.info('qbittorrent', `GET /api/v2/torrents/info caller=${caller}`);

    // Helper to normalize strings for matching
    function normalizeMatchValue(value: string | null | undefined): string {
        return (value || '')
            .toLowerCase()
            .replace(/[\s._-]+/g, ' ')
            .replace(/[^a-z0-9 ]/g, '')
            .trim();
    }

    // Map to store package sync data for response generation
    // Key: normalized title, Value: package stats from JDownloader
    const packageSyncData = new Map<string, {
        totalSize: number;
        loadedSize: number;
        speed: number;
        eta: number;
        status: string;
        progress: number;
    }>();

    // Sync JDownloader status first (real-time updates for Sonarr Activity)
    try {
        const jdConfig = await db.jDownloaderConfig.findFirst({
            where: { enabled: true },
            orderBy: { updatedAt: 'desc' }
        });

        if (jdConfig && jdConfig.mode === 'cloud' && jdConfig.email && jdConfig.password && jdConfig.deviceName) {
            const jdService = new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName);
            const authSuccess = await jdService.authenticate();

            if (authSuccess) {
                const jdDownloads = await jdService.getDownloads();

                // Group JDownloader items by package (category field contains package name)
                const packageMap = new Map<string, {
                    totalSize: number;
                    loadedSize: number;
                    speed: number;
                    eta: number;
                    status: string;
                    items: typeof jdDownloads;
                    hasPackageData: boolean;
                }>();

                for (const item of jdDownloads) {
                    const pkgName = item.category || item.name || 'Unknown';
                    const existing = packageMap.get(pkgName);

                    if (existing) {
                        // Package-level data is same for all items in package, so just use first
                        // But sum link-level data for fallback
                        if (!existing.hasPackageData) {
                            existing.totalSize += item.size || 0;
                            existing.loadedSize += (item.size || 0) * (item.progress / 100);
                            existing.speed += item.speed || 0;
                            if (item.eta > 0 && item.eta > existing.eta) {
                                existing.eta = item.eta;
                            }
                        }

                        existing.items.push(item);
                        // Update status: running/extracting takes precedence over finished/pending
                        if (item.status === 'running' || item.status === 'extracting') {
                            existing.status = item.status;
                        } else if (item.status === 'failed') {
                            existing.status = 'failed';
                        }
                    } else {
                        // First item for this package - prefer package-level data
                        const hasPackageData = !!(item.packageBytesTotal && item.packageBytesTotal > 0);
                        packageMap.set(pkgName, {
                            totalSize: hasPackageData ? item.packageBytesTotal! : (item.size || 0),
                            loadedSize: hasPackageData ? (item.packageBytesLoaded || 0) : (item.size || 0) * (item.progress / 100),
                            speed: item.packageSpeed || item.speed || 0,
                            eta: item.packageEta || item.eta || 0,
                            status: item.status,
                            items: [item],
                            hasPackageData: hasPackageData,
                        });
                    }
                }

                // Get all ARR downloads to match against
                const arrDownloads = await db.download.findMany({
                    where: { forumName: 'Sweaterr qBittorrent API' },
                    orderBy: { updatedAt: 'desc' },
                    take: 100,
                });

                // Match each package to an ARR download by normalized title
                for (const [pkgName, pkgData] of packageMap) {
                    const normalizedPkgName = normalizeMatchValue(pkgName);
                    const packageProgress = pkgData.totalSize > 0
                        ? pkgData.loadedSize / pkgData.totalSize
                        : 0;

                    // Determine package status
                    const allFinished = pkgData.items.every(i => i.status === 'finished');
                    const anyRunning = pkgData.items.some(i => i.status === 'running' || i.status === 'extracting');
                    const anyFailed = pkgData.items.some(i => i.status === 'failed');

                    let mappedStatus = 'pending';
                    if (allFinished) mappedStatus = 'completed';
                    else if (anyFailed) mappedStatus = 'failed';
                    else if (anyRunning) mappedStatus = 'downloading';
                    else if (packageProgress > 0) mappedStatus = 'downloading';

                    // Find matching ARR download by normalized title comparison
                    const matchedDownload = arrDownloads.find(d => {
                        const normalizedTitle = normalizeMatchValue(d.title);
                        const normalizedRelease = normalizeMatchValue(d.releaseTitle);
                        // Check if package name contains or is contained in the title
                        return normalizedTitle === normalizedPkgName ||
                            normalizedRelease === normalizedPkgName ||
                            normalizedPkgName.includes(normalizedTitle) ||
                            normalizedTitle.includes(normalizedPkgName);
                    });

                    if (matchedDownload) {
                        await db.download.update({
                            where: { id: matchedDownload.id },
                            data: {
                                status: mappedStatus,
                                progress: packageProgress,
                                updatedAt: new Date(),
                            },
                        });

                        // Calculate package ETA from speed (more accurate than individual link ETAs)
                        // JDownloader link ETA is for that specific link, not the whole package
                        const amountLeft = pkgData.totalSize - pkgData.loadedSize;
                        let eta: number;
                        if (pkgData.speed > 0) {
                            // ETA = remaining bytes / bytes per second (most accurate for package)
                            eta = Math.round(amountLeft / pkgData.speed);
                        } else if (pkgData.eta > 0) {
                            // Fallback: use max link ETA (already in seconds from JDownloader)
                            eta = pkgData.eta;
                        } else {
                            eta = 8640000; // infinity flag
                        }

                        // Store sync data for response generation (keyed by normalized title)
                        const normalizedTitle = normalizeMatchValue(matchedDownload.title);
                        packageSyncData.set(normalizedTitle, {
                            totalSize: pkgData.totalSize,
                            loadedSize: pkgData.loadedSize,
                            speed: pkgData.speed,
                            eta: eta,
                            status: mappedStatus,
                            progress: packageProgress,
                        });

                        // Also store by grabId for faster lookup
                        if (matchedDownload.grabId) {
                            const normalizedGrabId = matchedDownload.grabId.toLowerCase();
                            packageSyncData.set(normalizedGrabId, {
                                totalSize: pkgData.totalSize,
                                loadedSize: pkgData.loadedSize,
                                speed: pkgData.speed,
                                eta: eta,
                                status: mappedStatus,
                                progress: packageProgress,
                            });
                        }

                        logger.info('qbittorrent', `Synced package "${pkgName}" -> ${matchedDownload.title} (${(packageProgress * 100).toFixed(1)}%, ${mappedStatus}, speed=${(pkgData.speed / 1024 / 1024).toFixed(1)}MB/s, eta=${eta}s, remaining=${(amountLeft / 1024 / 1024 / 1024).toFixed(2)}GB)`);
                    }
                }
            }
        }
    } catch (err) {
        logger.warn('qbittorrent', `Failed to sync JDownloader status: ${err}`);
        // Continue anyway, use DB data as fallback
    }

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

                // Try to get real-time data from JDownloader sync
                const syncData = packageSyncData.get(normalized) ||
                    packageSyncData.get(normalizeMatchValue(row?.title)) ||
                    packageSyncData.get(normalizeMatchValue(row?.releaseTitle));

                const totalSize = syncData?.totalSize || 0;
                const loadedSize = syncData?.loadedSize || 0;
                const dlspeed = syncData?.speed || 0;
                const eta = syncData?.eta || (state === 'downloading' ? 8640000 : 0);
                const amountLeft = totalSize - loadedSize;

                return {
                    added_on: row ? Math.floor(new Date(row.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
                    amount_left: Math.round(amountLeft),
                    auto_tmm: false,
                    availability: 1,
                    category: row?.category || 'tv-sonarr',
                    completed: Math.round(loadedSize),
                    completion_on: state === 'uploading' && row ? Math.floor(new Date(row.updatedAt).getTime() / 1000) : 0,
                    content_path: '',
                    dl_limit: -1,
                    dlspeed: Math.round(dlspeed),
                    downloaded: Math.round(loadedSize),
                    downloaded_session: Math.round(loadedSize),
                    eta: eta,
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
                    size: Math.round(totalSize),
                    state,
                    super_seeding: false,
                    tags: '',
                    time_active: 0,
                    total_size: Math.round(totalSize),
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
            // Include all statuses so Sonarr can see both active and completed items
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

            // Try to get real-time data from JDownloader sync
            const syncData = packageSyncData.get(hash) ||
                packageSyncData.get(normalizeMatchValue(d.title)) ||
                packageSyncData.get(normalizeMatchValue(d.releaseTitle));

            const totalSize = syncData?.totalSize || 0;
            const loadedSize = syncData?.loadedSize || 0;
            const dlspeed = syncData?.speed || 0;
            const eta = syncData?.eta || (state === 'downloading' ? 8640000 : 0);
            const amountLeft = totalSize - loadedSize;

            return {
                added_on: Math.floor(new Date(d.createdAt).getTime() / 1000),
                amount_left: Math.round(amountLeft),
                auto_tmm: false,
                availability: 1,
                category: d.category || '',
                completed: Math.round(loadedSize),
                completion_on: state === 'uploading' ? Math.floor(new Date(d.updatedAt).getTime() / 1000) : 0,
                content_path: '',
                dl_limit: -1,
                dlspeed: Math.round(dlspeed),
                downloaded: Math.round(loadedSize),
                downloaded_session: Math.round(loadedSize),
                eta: eta,
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
                size: Math.round(totalSize),
                state,
                super_seeding: false,
                tags: '',
                time_active: 0,
                total_size: Math.round(totalSize),
                tracker: 'udp://tracker.sweaterr.local:6969',
                up_limit: -1,
                uploaded: 0,
                uploaded_session: 0,
                upspeed: 0,
            };
        });

    return NextResponse.json(torrents);
}
