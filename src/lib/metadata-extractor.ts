/**
 * Centralized metadata extraction module
 * 
 * CRITICAL: All functions are COPIED DIRECTLY from src/app/api/testing/metadata/route.ts
 * and should be used by ALL modules that need metadata parsing:
 * - src/app/api/testing/metadata/route.ts
 * - src/app/api/arr/search/route.ts
 * - src/app/api/arr/grab/route.ts
 * - Any future modules that need to extract/parse metadata
 * 
 * RULE: Do NOT create duplicate implementations. Always import from here.
 * Source of truth: testing/metadata/route.ts (verified working)
 */

import { extractSizeFromTitle } from './utils';

/**
 * Format bytes to human-readable size string
 * @example formatSize(1024) // "1 KB"
 * @example formatSize(1048576) // "1 MB"
 */
export function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Detect if text contains episode pattern [X/Y], [X de Y], etc
 * @example detectSeriesByEpisodePattern("[13/13]") // true
 * @example detectSeriesByEpisodePattern("[13 de 13]") // true
 * @example detectSeriesByEpisodePattern("no episodes") // false
 */
export function detectSeriesByEpisodePattern(text: string): boolean {
    // Match patterns like [13/13], [13 de 13], [ 13 / 13 ], [13de13]
    return /\[\s*(\d{1,3})\s*(?:de|\/)\s*(\d{1,3})\s*\]/i.test(text);
}

/**
 * Detect content type: series, movie, or unknown
 * Uses episode patterns, season indicators, and keywords
 */
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

/**
 * Extract year from text
 * Validates year is between 1950 and current year + 1
 * @example extractYear("Breaking Bad 2008") // 2008
 * @example extractYear("Movie (1999)") // 1999
 * @example extractYear("2050 future") // null (too far in future)
 */
export function extractYear(text: string): number | null {
    const match = text.match(/\b(19|20)\d{2}\b/);
    if (!match) return null;
    const year = parseInt(match[0], 10);
    if (year < 1950 || year > new Date().getFullYear() + 1) return null;
    return year;
}

/**
 * Extract season number from text
 * Supports: T1, T.5, 5ª Temporada, Season 3, 3º Season, etc.
 * Priority order:
 * 1. Ordinal patterns with text between (5ª 2/2 Temporada Final)
 * 2. Standard ordinals (5ª Temporada, 3º Season)
 * 3. Reverse patterns (Temporada 5ª, Season 3º)
 * 4. T-prefixed (T1, T.1, T5ª)
 * 5. S-prefixed (S1, Season 1)
 * 
 * @example extractSeason("Breaking Bad T5") // 5
 * @example extractSeason("Game of Thrones S02") // 2
 * @example extractSeason("5ª Temporada") // 5
 * @example extractSeason("Temporada 3ª") // 3
 */
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

/**
 * Extract quality and source from text
 * Looks for resolution (2160p, 1080p, 720p, etc.) and source (BluRay, WEB-DL, etc.)
 * Returns combined string if both found, single value otherwise
 * @example extractQuality("1080p BluRay") // "1080p BluRay"
 * @example extractQuality("720p WEB-DL") // "720p WEB-DL"
 * @example extractQuality("no quality") // null
 */
export function extractQuality(text: string): string | null {
    const qualityMatch = text.match(/\b(2160p|4k|1080p|720p|480p)\b/i);
    const sourceMatch = text.match(/\b(BluRay|BRRip|WEB[- ]?DL|WebRip|HDRip|DVDRip|HMAX|DVDScr)\b/i);
    if (qualityMatch && sourceMatch) return `${qualityMatch[1]} ${sourceMatch[1]}`;
    if (qualityMatch) return qualityMatch[1];
    return null;
}

/**
 * Extract audio and subtitle languages from text
 * Detects: es-ES, es-LA, en, fr, etc.
 * Also detects generic subtitles if no specific language found
 * 
 * @example extractLanguages("Castellano + Inglés")
 * // { audio: ['es-ES', 'en'], subtitles: [] }
 * @example extractLanguages("Dual (Español/Inglés) + Subtítulos en Español")
 * // { audio: ['es-ES', 'en'], subtitles: ['es-ES'] }
 */
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

/**
 * Extract episode numbers from text
 * Supports: [13/13], [13 de 13], (13), 13/13, etc.
 * Returns object with available and total episode counts
 * 
 * @example extractEpisodes("[13/13]") // { available: 13, total: 13 }
 * @example extractEpisodes("[13 de 13]") // { available: 13, total: 13 }
 * @example extractEpisodes("no episodes") // {}
 */
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

/**
 * Extract episode numbers from text for Newznab/arr format
 * Converts [X/Y] or [X de Y] patterns to comma-separated episode list "1,2,3,...,N"
 * Used by arr/search to generate Newznab-compatible episode lists
 * 
 * @example extractEpisodesForNewznab("[16/16]") // "1,2,3,...,16"
 * @example extractEpisodesForNewznab("[10 de 10]") // "1,2,3,...,10"
 * @example extractEpisodesForNewznab("no episodes") // null
 */
export function extractEpisodesForNewznab(text: string): string | null {
  if (!text || typeof text !== 'string') return null;

  // Use extractEpisodes to get the parsed values, then generate list
  const parsed = extractEpisodes(text);
  if (!parsed.total || parsed.total < 1 || parsed.total > 300) return null;
  
  // Generate comma-separated list "1,2,3,...,N"
  return Array.from({ length: parsed.total }, (_, i) => i + 1).join(',');
}

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
