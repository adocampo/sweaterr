'use client';

import { useCallback, useMemo } from 'react';
import esTranslations from '@/locales/es.json';
import enTranslations from '@/locales/en.json';

type Language = 'es' | 'en';

interface Translations {
    [key: string]: any;
}

// Import translations
const translations: Record<Language, Translations> = {
    es: esTranslations,
    en: enTranslations,
};

export function useI18n(language: Language = 'es') {
    // Get the translation object for the current language
    const currentTranslations = useMemo(() => {
        return translations[language] || translations.es;
    }, [language]);

    // Helper function to get nested translation by path (e.g., "auth.login")
    const t = useCallback(
        (path: string): string => {
            const keys = path.split('.');
            let value: any = currentTranslations;

            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    console.warn(`[i18n] Missing translation key: ${path}`);
                    return path;
                }
            }

            return typeof value === 'string' ? value : path;
        },
        [currentTranslations]
    );

    return { t, language };
}

/**
 * Server-side helper to get translations
 */
export function getTranslation(language: Language, path: string): string {
    const keys = path.split('.');
    let value: any = translations[language] || translations.es;

    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return path;
        }
    }

    return typeof value === 'string' ? value : path;
}
