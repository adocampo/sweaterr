'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import esTranslations from '@/locales/es.json';
import enTranslations from '@/locales/en.json';

type Language = 'es' | 'en';

interface Translations {
    [key: string]: any;
}

type TranslationParams = Record<string, string | number | boolean | null | undefined>;

// Import translations
const translations: Record<Language, Translations> = {
    es: esTranslations,
    en: enTranslations,
};

const VALID_LANGUAGES: Record<string, Language> = {
    es: 'es',
    en: 'en',
    es_es: 'es',
    en_us: 'en',
    en_gb: 'en',
};

const STORAGE_KEY = 'sweaterr-language';

/**
 * Resolve the preferred language with this priority:
 * 1. Explicit language parameter passed to useI18n()
 * 2. User preference stored in localStorage (set via UserMenu)
 * 3. Browser language (navigator.language)
 * 4. Fallback to 'en'
 */
function resolveLanguage(
    explicit?: Language,
    userLanguage?: string | null
): Language {
    // 1. Explicit parameter wins
    if (explicit && VALID_LANGUAGES[explicit]) {
        return explicit;
    }

    // 2. User stored preference (from localStorage or user object)
    if (userLanguage && VALID_LANGUAGES[userLanguage]) {
        return userLanguage;
    }

    // 3. Browser language / localStorage
    if (typeof window !== 'undefined') {
        // Check localStorage first (user preference overrides browser setting)
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && VALID_LANGUAGES[stored]) {
            return stored;
        }

        // Then check browser language
        const browserLang = navigator.language.toLowerCase();
        const mapped = VALID_LANGUAGES[browserLang];
        if (mapped) return mapped;

        // Try without region (e.g. "es-es" -> "es")
        const baseLang = browserLang.split('-')[0];
        if (VALID_LANGUAGES[baseLang]) return VALID_LANGUAGES[baseLang];
    }

    // 4. Fallback to English
    return 'en';
}

function interpolate(value: string, params?: TranslationParams): string {
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (_, key: string) => {
        const paramValue = params[key];
        return paramValue === undefined || paramValue === null ? '' : String(paramValue);
    });
}

export function useI18n(
    explicit?: Language,
    userLanguage?: string | null
) {
    // Prevent hydration mismatch: defer to client-side value after first render
    // Initialize with resolved language on the client
    const [resolvedLanguage, setResolvedLanguage] = useState<Language>(() => {
        return resolveLanguage(explicit, userLanguage);
    });
    const [isHydrated, setIsHydrated] = useState(false);

    // On the client, try to read from localStorage as fallback
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && VALID_LANGUAGES[stored]) {
                setResolvedLanguage(stored);
            }
        }
        setIsHydrated(true);
    }, []);

    // Listen for language changes from other components (e.g. UserMenu)
    useEffect(() => {
        const handleLanguageChange = () => {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && VALID_LANGUAGES[stored]) {
                setResolvedLanguage(stored);
            }
        };

        const handleStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue && VALID_LANGUAGES[e.newValue as Language]) {
                setResolvedLanguage(e.newValue as Language);
            }
        };

        window.addEventListener('sweaterr-languagechange', handleLanguageChange);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('sweaterr-languagechange', handleLanguageChange);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    // Update resolved language when explicit/userLanguage params change
    useEffect(() => {
        const resolved = resolveLanguage(explicit, userLanguage);
        setResolvedLanguage(resolved);
    }, [explicit, userLanguage]);

    // Use the resolved value after hydration
    const effectiveLanguage = isHydrated ? resolvedLanguage : (explicit || 'en');

    // Get the translation object for the current language
    const currentTranslations = useMemo(() => {
        return translations[effectiveLanguage] || translations.es;
    }, [effectiveLanguage]);

    // Helper function to get nested translation by path (e.g., "auth.login")
    const t = useCallback(
        (path: string, params?: TranslationParams): string => {
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

            const template = typeof value === 'string' ? value : path;
            return interpolate(template, params);
        },
        [currentTranslations]
    );

    return { t, language: effectiveLanguage };
}

/**
 * Server-side helper to get translations
 */
export function getTranslation(language: Language, path: string, params?: TranslationParams): string {
    const keys = path.split('.');
    let value: any = translations[language] || translations.es;

    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return path;
        }
    }

    const template = typeof value === 'string' ? value : path;
    return interpolate(template, params);
}