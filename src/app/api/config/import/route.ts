import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/services/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';

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

const importSchema = z.object({
  version: z.number().optional(),
  data: z.object({
    forums: z.array(z.record(z.string(), z.any())).optional().default([]),
    jdownloaderConfigs: z.array(z.record(z.string(), z.any())).optional().default([]),
    aiConfigs: z.array(z.record(z.string(), z.any())).optional().default([]),
    flaresolverrConfigs: z.array(z.record(z.string(), z.any())).optional().default([]),
    tmdbConfigs: z.array(z.record(z.string(), z.any())).optional().default([]),
    arrServices: z.array(z.record(z.string(), z.any())).optional().default([]),
  }),
});

// POST /api/config/import - Replace all app configuration with the imported data
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  let parsed;
  try {
    const body = await request.json();
    parsed = importSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Invalid import file' },
      { status: 400 }
    );
  }

  const { forums, jdownloaderConfigs, aiConfigs, flaresolverrConfigs, tmdbConfigs, arrServices } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      // Wipe existing config (credentials cascade with forums)
      await tx.forumCredential.deleteMany();
      await tx.forum.deleteMany();
      await tx.jDownloaderConfig.deleteMany();
      await tx.aIConfig.deleteMany();
      await tx.flareSolverrConfig.deleteMany();
      await tx.tmdbConfig.deleteMany();
      await tx.arrService.deleteMany();

      for (const forum of forums) {
        const { credentials, ...forumData } = forum;
        await tx.forum.create({
          data: {
            ...forumData,
            createdAt: forumData.createdAt ? new Date(forumData.createdAt) : undefined,
            updatedAt: forumData.updatedAt ? new Date(forumData.updatedAt) : undefined,
            cookiesUpdatedAt: forumData.cookiesUpdatedAt ? new Date(forumData.cookiesUpdatedAt) : undefined,
            credentials: credentials
              ? { create: { username: credentials.username, password: credentials.password } }
              : undefined,
          },
        });
      }

      for (const jd of jdownloaderConfigs) {
        await tx.jDownloaderConfig.create({
          data: {
            ...jd,
            createdAt: jd.createdAt ? new Date(jd.createdAt) : undefined,
            updatedAt: jd.updatedAt ? new Date(jd.updatedAt) : undefined,
          },
        });
      }

      for (const ai of aiConfigs) {
        await tx.aIConfig.create({
          data: {
            ...ai,
            createdAt: ai.createdAt ? new Date(ai.createdAt) : undefined,
            updatedAt: ai.updatedAt ? new Date(ai.updatedAt) : undefined,
          },
        });
      }

      for (const fs of flaresolverrConfigs) {
        await tx.flareSolverrConfig.create({
          data: {
            ...fs,
            createdAt: fs.createdAt ? new Date(fs.createdAt) : undefined,
            updatedAt: fs.updatedAt ? new Date(fs.updatedAt) : undefined,
          },
        });
      }

      for (const tmdb of tmdbConfigs) {
        await tx.tmdbConfig.create({
          data: {
            ...tmdb,
            createdAt: tmdb.createdAt ? new Date(tmdb.createdAt) : undefined,
            updatedAt: tmdb.updatedAt ? new Date(tmdb.updatedAt) : undefined,
          },
        });
      }

      for (const arr of arrServices) {
        await tx.arrService.create({
          data: {
            ...arr,
            createdAt: arr.createdAt ? new Date(arr.createdAt) : undefined,
            updatedAt: arr.updatedAt ? new Date(arr.updatedAt) : undefined,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
