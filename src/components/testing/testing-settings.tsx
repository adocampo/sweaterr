'use client';

interface TestingSettingsProps {
    language?: 'es' | 'en';
}

export function TestingSettings({ language = 'es' }: TestingSettingsProps) {
    // FlareSolverr is always used unconditionally - no UI needed
    return null;
}
