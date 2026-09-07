import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import SetupForm from './setup-form';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
    // Server-side check: if users exist, redirect immediately (no client flash)
    const userCount = await db.user.count();
    if (userCount > 0) {
        redirect('/login');
    }

    return <SetupForm />;
}
