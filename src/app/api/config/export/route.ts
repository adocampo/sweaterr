import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/services/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const EXPORT_VERSION = 1;

function requireAdmin(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  const cookies = Object.fromEntries(request.cookies.getAll().map((c) => [c.name, c.value]));
  const token = extractToken(headers, cookies);
  if (!token) return { ok: false, status: 401, message: 'No token provided' } as const;
  const decoded = verifyToken(token);
  if (!decoded) return { ok: false, status: 401, message: 'Invalid or expired token' } as const;
  if (decoded.role !== 'admin') return { ok: false, status: 403, message: 'Admin only' } as const;
  return { ok: true, userId: decoded.id } as const;
}

// GET /api/config/export - Export all app configuration (excludes users, downloads, search/history)
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    const [forums, jdownloaderConfigs, aiConfigs, flaresolverrConfigs, tmdbConfigs, arrServices] = await Promise.all([
      db.forum.findMany({ include: { credentials: true } }),
      db.jDownloaderConfig.findMany(),
      db.aIConfig.findMany(),
      db.flareSolverrConfig.findMany(),
      db.tmdbConfig.findMany(),
      db.arrService.findMany(),
    ]);

    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        forums,
        jdownloaderConfigs,
        aiConfigs,
        flaresolverrConfigs,
        tmdbConfigs,
        arrServices,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}
