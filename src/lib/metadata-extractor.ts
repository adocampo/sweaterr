/**
 * Centralized metadata extraction functions
 * 
 * IMPORTANT: These functions are the SOURCE OF TRUTH for metadata parsing.
 * They are extracted from src/app/api/testing/metadata/route.ts (verified working)
 * and exported for reuse by all modules:
 * - src/app/api/testing/metadata/route.ts
 * - src/app/api/arr/search/route.ts
 * - Any future modules requiring metadata extraction
 * 
 * RULE: All implementations here are COPIED EXACTLY from testing.
 * DO NOT create duplicate implementations elsewhere.
 * Import and use these functions from this module.
 */

// Detect if text contains [X/Y] episode pattern (indicates series)
export function detectSeriesByEpisodePattern(text: string): boolean {
    // Match patterns like [13/13], [13 de 13], [ 13 / 13 ], [13de13]
    return /\[\s*(\d{1,3})\s*(?:de|\/)\s*(\d{1,3})\s*\]/i.test(text);
}

export function detectType(title: string, breadcrumbs: string): 'series' | 'movie' | 'unknown' {
    // STRICT: If there's an episode pattern, it's definitely a series
    if (detectSeriesByEpisodePattern(title)) {
        return 'series';
    }
    
    // Only detect as series if there are CLEAR season-related indicators in the TITLE
    // Don't rely on breadcrumbs or generic "serie" keyword, which are too permissive
    const lowerTitle = title.toLowerCase();
    
    const hasSeasonIndicators = 
        /\btemporada\s+\d+\b/i.test(title) ||
        /\d+(?:ª|º)\s+.{0,20}?\btemporada\b/i.test(title) || // 5ª 2/2 Temporada Final
        /\d+(?:ª|º)\s*temporada\b/i.test(title) || // 5ª Temporada, 3º Temporada
        /\b[Tt]\s*\d{1,2}\b/.test(title) ||
        /\bseason\s+\d+\b/i.test(title) ||
        /\bs\d{1,2}\b/i.test(title) ||
        /\bserial\b/i.test(title);
    
    if (hasSeasonIndicators) {
        return 'series';
    }
    
    // Check for movie keywords
    const movieKeywords = ['película', 'movie', 'film', 'cinema'];
    if (movieKeywords.some(keyword => lowerTitle.includes(keyword))) {
        return 'movie';
    }
    
    // Default to unknown for ambiguous content that doesn't match clear patterns
    // This prevents false positives for incorrectly posted content
    return 'unknown';
}

export function extractYear(text: string): number | null {
    const match = text.match(/\b(19|20)\d{2}\b/);
    if (!match) return null;
    const year = parseInt(match[0], 10);
    if (year < 1950 || year > new Date().getFullYear() + 1) return null;
    return year;
}

export function extractSeason(text: string): number | null {
    // Priority 1: Ordinal patterns with possible text between: "5ª 2/2 Temporada Final", "3º mitad Temporada"
    // Allow up to 20 chars between ordinal and "temporada" word to be flexible
    let match = text.match(/(\d{1,2})(?:ª|º)\s+.{0,20}?\b(?:temporada|temp\.?|season)\b/i);
    if (match) return parseInt(match[1], 10);
    
    // Standard ordinal without text between: "5ª Temporada", "3º Season"
    match = text.match(/(\d{1,2})(?:ª|º)\s*(?:temporada|temp\.?|season)/i);
    if (match) return parseInt(match[1], 10);

    // Reverse pattern: "Temporada 15ª", "Season 3º"
    match = text.match(/(?:temporada|temp\.?|season)\s*(\d{1,2})(?:ª|º)?/i);
    if (match) return parseInt(match[1], 10);

    // Priority 2: T-prefixed patterns: T1, T.1, T5ª, etc
    match = text.match(/\b[Tt]\.?(\d{1,2})/i);
    if (match) return parseInt(match[1], 10);

    // Priority 3: S-prefixed patterns: S1, Season 1, etc
    match = text.match(/\b[Ss](?:eason)?\s*(\d{1,2})/i);
    if (match) return parseInt(match[1], 10);

    return null;
}

export function extractQuality(text: string): string | null {
    const qualityMatch = text.match(/\b(2160p|4k|1080p|720p|480p)\b/i);
    const sourceMatch = text.match(/\b(BluRay|BRRip|WEB[- ]?DL|WebRip|HDRip|DVDRip|HMAX|DVDScr)\b/i);
    if (qualityMatch && sourceMatch) return `${qualityMatch[1]} ${sourceMatch[1]}`;
    if (qualityMatch) return qualityMatch[1];
    return null;
}

export function extractLanguages(text: string): { audio: string[]; subtitles: string[] } {
    const lower = text.toLowerCase();
    const audio: string[] = [];
    const subtitles: string[] = [];

    const audioMatchers: Record<string, RegExp[]> = {
        'es-ES': [/castellano/, /español/, /es-?es/],
        'es-LA': [/latino/, /latam/],
        en: [/ingles/, /inglés/, /english/],
        fr: [/frances/, /francés/],
    };

    const subtitleMatchers: Record<string, RegExp[]> = {
        'es-ES': [/sub(?:s|titulos)?\s*(?:es|esp|español|castellano)/, /sub\s?esp/],
        en: [/sub(?:s|titles)?\s*en/, /sub\s?ing/],
    };

    Object.entries(audioMatchers).forEach(([lang, patterns]) => {
        if (patterns.some((rx) => rx.test(lower))) audio.push(lang);
    });

    Object.entries(subtitleMatchers).forEach(([lang, patterns]) => {
        if (patterns.some((rx) => rx.test(lower))) subtitles.push(lang);
    });

    // Generic subtitles
    if (/subtit|subs/.test(lower) && subtitles.length === 0) subtitles.push('unknown');

    return { audio, subtitles };
}

export function extractEpisodes(text: string): { available?: number | null; total?: number | null } {
    // Match patterns like [13/13], [13 de 13], [ 13 / 13 ]
    const match = text.match(/\[\s*(\d{1,3})\s*(?:de|\/)\s*(\d{1,3})\s*\]/i);
    if (match) {
        const available = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        // Validate range 1-300
        if (available >= 1 && available <= 300 && total >= 1 && total <= 300) {
            return { available, total };
        }
    }
    return {};
}

// Extract clean title by removing metadata (year, season, episodes, quality, size, languages, etc)
export function extractCleanTitle(text: string): string {
    let clean = text;
    
    // Remove year patterns (1900-2099)
    clean = clean.replace(/\b(19|20)\d{2}\b/g, '');
    
    // Remove ordinal season+episode patterns: 5ª 1/2, 5ª 2/, 3º 1/2, etc
    clean = clean.replace(/\b\d{1,2}(?:ª|º)\s+\d{1,2}\/\d{0,2}\b/gi, '');
    clean = clean.replace(/\b\d{1,2}(?:ª|º)\s+\d{1,2}\/\b/gi, '');
    
    // Remove season patterns: T1, T.1, T01, Temporada 1, 1ª Temporada, Season 1, etc
    clean = clean.replace(/\b[Tt]\.?\d{1,2}\b/gi, '');
    clean = clean.replace(/\b(?:[Tt]emporada|[Ss]eason)\s+\d{1,2}(?:ª|º)?\b/gi, '');
    clean = clean.replace(/\b\d{1,2}(?:ª|º)?\s+(?:[Tt]emporada|[Ss]eason)\b/gi, '');
    
    // Remove standalone "Temporada" or "Season" words (in case they remain after number removal)
    clean = clean.replace(/\b(?:[Tt]emporada|[Ss]eason)\b/gi, '');
    
    // Remove "Final" keyword (often used for final season/episodes)
    clean = clean.replace(/\bFinal\b/gi, '');
    
    // Remove episode/chapter patterns: [13/13], [13 de 13], Capítulo 5, etc
    clean = clean.replace(/\[\s*\d{1,3}\s*(?:de|\/)\s*\d{1,3}\s*\]/gi, '');
    clean = clean.replace(/\b(?:[Cc]apítulo|[Ee]pisodio|[Cc]ap\.|[Ee]p\.?)\s+\d+\b/gi, '');
    
    // Remove quality patterns: 2160p, 4K, 1080p, 720p, 480p
    clean = clean.replace(/\b(2160p|4k|1080p|720p|480p)\b/gi, '');
    
    // Remove source patterns: BluRay, WEB-DL, HDRip, h.264, x.265, HEVC, etc
    clean = clean.replace(/\b(BluRay|BRRip|WEB[-\s]?DL|WebRip|HDRip|DVDRip|HMAX|DVDScr|h\.?264|h\.?265|x\.?264|x\.?265|hevc|avc)\b/gi, '');
    
    // Remove audio formats and codecs: DDP5.1, DD5.1, AC35.1, 5.1, 7.1, etc
    clean = clean.replace(/\b(DDP|DD|AC3|AAC|FLAC)\s*\d\.\d\b/gi, '');
    clean = clean.replace(/\b\d\.\d\s*(?:ch|channels|canales)?\b/gi, '');
    
    // Remove HDR/color patterns: Dolby Vision, HDR, HDR10, 10-bit, etc
    clean = clean.replace(/\b(Dolby\s+Vision|Dolby\s+Atmos|HDR10|HDR|10[-\s]?bit|Dolby\s+Digital)\b/gi, '');
    
    // Remove size patterns: 2.5GB, 3.14 MB, etc
    clean = clean.replace(/\b\d+(?:[.,]\d+)?\s*(?:GB|GiB|MB|MiB)\b/gi, '');
    
    // Remove language patterns and subtitle indicators: Dual, Castellano, Inglés, Español, English, Subt, Subs, etc
    clean = clean.replace(/\b(?:Dual|Castellano|Español|Inglés|English|Francés|Latino|Latin|Latam|Japones|Japonés|Coreano|Koreano|Subt|Subs|Sub)\b/gi, '');
    
    // Remove special/bracketed patterns: [...] and (...)
    clean = clean.replace(/\[.*?\]/g, '');
    clean = clean.replace(/\(.*?\)/g, '');
    
    // Remove + prefixed metadata (e.g., "+ Subt", "+ Castellano", "+ Dual")
    clean = clean.replace(/\s*\+\s+\w+/gi, '');
    clean = clean.replace(/\s*\+\s*$/g, ''); // Remove trailing +
    
    // Remove stray brackets and plus signs that may remain
    clean = clean.replace(/[\[\]]/g, '');
    clean = clean.replace(/\s*\+\s*$/g, ''); // Remove trailing + with spaces
    clean = clean.replace(/^\s*\+\s*/g, ''); // Remove leading + with spaces
    
    // Remove extra whitespace and trim
    clean = clean.replace(/\s+/g, ' ').trim();
    
    return clean;
}

/**
 * Helper: Convert episode count to comma-separated list for Newznab format
 * Used by arr/search to generate proper episode lists
 * @example episodeCountToNewznabList(16) // "1,2,3,...,16"
 */
export function episodeCountToNewznabList(count: number): string {
    if (count < 1 || count > 300) return '';
    return Array.from({ length: count }, (_, i) => i + 1).join(',');
}
