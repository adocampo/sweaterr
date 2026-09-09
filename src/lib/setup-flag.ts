/**
 * Utility to check if setup is complete by tracking a file flag.
 * Avoids in-memory cache resets on dev server reloads and edge-runtime fetch issues.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const SETUP_FLAG_DIR = join(process.cwd(), '.data');
const SETUP_FLAG_FILE = join(SETUP_FLAG_DIR, '.setup-complete');

export function markSetupComplete(): void {
    if (!existsSync(SETUP_FLAG_DIR)) {
        mkdirSync(SETUP_FLAG_DIR, { recursive: true });
    }
    writeFileSync(SETUP_FLAG_FILE, 'true');
}

export function isSetupComplete(): boolean {
    return existsSync(SETUP_FLAG_FILE);
}

export function removeSetupFlag(): void {
    try {
        unlinkSync(SETUP_FLAG_FILE);
    } catch {
        // Ignore errors if file doesn't exist
    }
}
