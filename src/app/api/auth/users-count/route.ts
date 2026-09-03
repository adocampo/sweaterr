import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Public endpoint to check if any users exist in the database.
 * Used by login/setup pages to conditionally show registration UI.
 */
export async function GET() {
    try {
        const count = await db.user.count();

        return NextResponse.json({ success: true, count });
    } catch (error) {
        console.error('[GET /api/auth/users-count] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch user count' },
            { status: 500 }
        );
    }
}
