// Next.js instrumentation hook — runs once when the server starts.
// Used to start background services like the JDownloader downloads warm-up.

export async function register() {
  // Only run on the Node.js server runtime (not Edge or client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startDownloadsWarmup } = await import('@/lib/services/downloads-cache');
    startDownloadsWarmup();
  }
}
