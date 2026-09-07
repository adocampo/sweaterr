// Server-side download status cache with background refresh.
// Avoids authenticating and querying MyJDownloader on every client poll.

import { db } from '@/lib/db';
import { JDownloaderService } from '@/lib/services/jdownloader';
import { logger } from '@/lib/logger';

export interface CachedDownload {
  uuid: string;
  name: string;
  status: string;
  progress: number;
  size?: number;
  speed?: number;
  eta?: number;
  host?: string;
  category?: string;
  [key: string]: unknown;
}

interface CacheState {
  downloads: CachedDownload[];
  lastFetch: number;
  fetching: boolean;
  configured: boolean;
}

const state: CacheState = {
  downloads: [],
  lastFetch: 0,
  fetching: false,
  configured: false,
};

const CACHE_TTL_MS = 8_000; // consider fresh for 8s; background refresh keeps it warm
const REFRESH_INTERVAL_MS = 10_000; // background refresh cadence

function normalizeMatchValue(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/[\s._-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

async function syncDownloadsToDb(jdDownloads: any[]) {
  for (const jdDownload of jdDownloads) {
    try {
      const mappedStatus =
        jdDownload.status === 'finished' ? 'completed' :
          jdDownload.status === 'running' ? 'downloading' :
            jdDownload.status === 'extracting' ? 'downloading' :
              jdDownload.status === 'failed' ? 'failed' : 'pending';

      const existingDownload = await db.download.findFirst({
        where: { jDownloaderId: jdDownload.uuid },
      });

      const size = jdDownload.size
        ? `${(jdDownload.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
        : undefined;
      const progress = (jdDownload.progress / 100) || 0;

      if (existingDownload) {
        await db.download.update({
          where: { id: existingDownload.id },
          data: { status: mappedStatus, progress, size, updatedAt: new Date() },
        });
        continue;
      }

      const normalizedCategory = normalizeMatchValue(jdDownload.category);
      const normalizedName = normalizeMatchValue(jdDownload.name);

      let matchedDownload: { id: string } | null = null;
      if (normalizedCategory || normalizedName) {
        const candidates = await db.download.findMany({
          where: { forumName: 'Sweaterr qBittorrent API', jDownloaderId: null },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        });

        matchedDownload =
          candidates.find((c) => normalizeMatchValue(c.releaseTitle) === normalizedCategory) ||
          candidates.find((c) => normalizeMatchValue(c.title) === normalizedCategory) ||
          candidates.find((c) => normalizeMatchValue(c.releaseTitle) === normalizedName) ||
          candidates.find((c) => normalizeMatchValue(c.title) === normalizedName) ||
          null;
      }

      if (matchedDownload) {
        await db.download.update({
          where: { id: matchedDownload.id },
          data: { jDownloaderId: jdDownload.uuid, status: mappedStatus, progress, size, updatedAt: new Date() },
        });
        continue;
      }

      await db.download.create({
        data: {
          title: jdDownload.name,
          sourceUrl: '',
          forumName: 'JDownloader',
          jDownloaderId: jdDownload.uuid,
          status: mappedStatus,
          progress,
          size,
        },
      });
    } catch (err) {
      // A single record failure shouldn't abort the whole sync
      logger.warn('jdownloader', `Failed to sync download record: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// Perform a full fetch from MyJDownloader and populate the cache + DB.
// Returns true on success. Never throws.
async function doRefresh(): Promise<boolean> {
  if (state.fetching) return state.downloads.length > 0;
  state.fetching = true;

  try {
    const jdConfig = await db.jDownloaderConfig.findFirst({
      where: { enabled: true },
      orderBy: { updatedAt: 'desc' },
    });

    state.configured = !!jdConfig;

    if (!jdConfig || jdConfig.mode === 'local') {
      state.downloads = [];
      state.lastFetch = Date.now();
      return true;
    }

    if (!jdConfig.email || !jdConfig.password || !jdConfig.deviceName) {
      state.downloads = [];
      state.lastFetch = Date.now();
      return false;
    }

    const jdService = new JDownloaderService(jdConfig.email, jdConfig.password, jdConfig.deviceName);
    const authSuccess = await jdService.authenticate();
    if (!authSuccess) {
      state.lastFetch = Date.now();
      return false;
    }

    const jdDownloads = await jdService.getDownloads();
    state.downloads = jdDownloads as unknown as CachedDownload[];
    state.lastFetch = Date.now();

    await syncDownloadsToDb(jdDownloads);
    return true;
  } catch (err) {
    logger.error('jdownloader', `Background refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    state.lastFetch = Date.now();
    return false;
  } finally {
    state.fetching = false;
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

// Start the background refresh loop. Safe to call multiple times.
export function startDownloadsWarmup() {
  if (refreshTimer) return;
  // Immediate warm-up, then periodic refresh
  void doRefresh();
  refreshTimer = setInterval(() => void doRefresh(), REFRESH_INTERVAL_MS);
  // Don't keep the Node process alive just for the cache loop
  if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
  logger.info('jdownloader', 'Downloads status warm-up started');
}

// Force an immediate refresh (e.g. after saving a successful JDownloader config).
export async function refreshDownloadsNow(): Promise<boolean> {
  return doRefresh();
}

// Read the cache. If stale and not currently fetching, trigger a background refresh.
export async function getCachedDownloads(): Promise<{
  downloads: CachedDownload[];
  configured: boolean;
  fresh: boolean;
  fetching: boolean;
}> {
  const age = Date.now() - state.lastFetch;
  const fresh = age < CACHE_TTL_MS;
  if (!fresh && !state.fetching) {
    void doRefresh();
  }
  return {
    downloads: state.downloads,
    configured: state.configured,
    fresh,
    fetching: state.fetching,
  };
}
