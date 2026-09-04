import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/services/auth';

export const runtime = 'nodejs';

const logsDir = path.join(process.cwd(), 'logs');
const maxLines = 1500;
const tailBytes = 512 * 1024;

function requireAdmin(request: NextRequest) {
    const headers = Object.fromEntries(request.headers.entries());
    const cookies = Object.fromEntries(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]));
    const token = extractToken(headers, cookies);
    if (!token) return { ok: false, status: 401, message: 'No token provided' } as const;

    const decoded = verifyToken(token);
    if (!decoded) return { ok: false, status: 401, message: 'Invalid or expired token' } as const;
    if (decoded.role !== 'admin') return { ok: false, status: 403, message: 'Admin only' } as const;

    return { ok: true } as const;
}

function parseLogLine(source: string, line: string, index: number) {
    const timestamp = line.match(/^\[([^\]]+)\]/)?.[1] || '';
    return { id: `${source}:${index}:${line}`, source, timestamp, line };
}

async function getLogNames(): Promise<string[]> {
    return (await fs.readdir(logsDir))
        .filter((name) => name.endsWith('.log'))
        .sort();
}

async function readTail(filePath: string): Promise<string> {
    const handle = await fs.open(filePath, 'r');
    try {
        const { size } = await handle.stat();
        const length = Math.min(size, tailBytes);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, Math.max(0, size - length));
        const content = buffer.toString('utf8');
        return size > length ? content.slice(content.indexOf('\n') + 1) : content;
    } finally {
        await handle.close();
    }
}

export async function GET(request: NextRequest) {
    const auth = requireAdmin(request);
    if (!auth.ok) {
        return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
    }

    try {
        const names = await getLogNames();
        const sourceParams = request.nextUrl.searchParams.getAll('source');
        const selectedNames = sourceParams.length === 0
            ? names
            : sourceParams.includes('all')
                ? names
                : names.filter((name) => sourceParams.includes(name.slice(0, -4)));

        const entries = (await Promise.all(selectedNames.map(async (name) => {
            const content = await readTail(path.join(logsDir, name));
            const source = name.slice(0, -4);
            return content
                .split('\n')
                .filter(Boolean)
                .slice(-maxLines)
                .map((line, index) => parseLogLine(source, line, index));
        }))).flat();

        entries.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
        return NextResponse.json({
            success: true,
            data: {
                sources: names.map((name) => name.slice(0, -4)),
                entries: entries.slice(-maxLines),
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not read logs';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const auth = requireAdmin(request);
    if (!auth.ok) {
        return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
    }

    try {
        const requestedSource = request.nextUrl.searchParams.get('source') || 'all';
        const names = await getLogNames();
        const selectedNames = requestedSource === 'all'
            ? names
            : names.includes(`${requestedSource}.log`) ? [`${requestedSource}.log`] : [];

        await Promise.all(selectedNames.map((name) => fs.truncate(path.join(logsDir, name), 0)));
        return NextResponse.json({ success: true, data: { cleared: selectedNames.map((name) => name.slice(0, -4)) } });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not clear logs';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
