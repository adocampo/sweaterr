import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract file size from title string.
 * Supports patterns like: 4.5 GB, 2.3 MB, 100 B, 1.5 GiB, 500 MiB, etc.
 * Returns size in bytes, or null if not found or invalid.
 *
 * @param title - The title string to parse (e.g., "Game of Thrones S01 4.5 GB 1080p")
 * @returns Size in bytes, or null if not found
 *
 * @example
 * extractSizeFromTitle("Breaking Bad T5 [16/16] 50GB") // 50000000000
 * extractSizeFromTitle("Movie 1.5 GiB") // 1610612736
 * extractSizeFromTitle("No size here") // null
 */
export function extractSizeFromTitle(title: string): number | null {
  if (!title || typeof title !== 'string') return null;

  // Pattern: number (with optional decimal point) + optional space + unit (GB, MB, B, GiB, MiB, etc.)
  // Examples: 4.5 GB, 2.3MB, 100 B, 1.5GiB, 500MiB
  /* 
   * Fixed regex to avoid matching "10 bit" as "10 B". 
   * Added word boundaries \b at start and end.
   */
  const match = title.match(/\b(\d+(?:\.\d+)?)\s*(TB|GB|MB|B|TiB|GiB|MiB|KiB)\b/i);

  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  // Conversion factors to bytes
  const unitMap: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'KIB': 1024,
    'MB': 1024 * 1024,
    'MIB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'GIB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
    'TIB': 1024 * 1024 * 1024 * 1024,
  };

  const multiplier = unitMap[unit];
  if (!multiplier) return null;

  const sizeInBytes = Math.round(value * multiplier);

  // Validate: size should be reasonable (> 0 and < 1 PB)
  if (sizeInBytes <= 0 || sizeInBytes > 1024 * 1024 * 1024 * 1024 * 1024) {
    return null;
  }

  return sizeInBytes;
}
/**
 * Extract season number from title string.
 * Supports patterns like: T1, T.5, 5ª Temporada, Season 3, 3º Season, etc.
 * Returns season number (1-99), or null if not found.
 *
 * @param title - The title string to parse (e.g., "Breaking Bad T5 [16/16]")
 * @returns Season number (1-99), or null if not found
 *
 * @example
 * extractSeasonFromTitle("Breaking Bad T5 [16/16]") // 5
 * extractSeasonFromTitle("Game S02 1080p") // 2
 * extractSeasonFromTitle("5ª Temporada") // 5
 * extractSeasonFromTitle("No season here") // null
 */
export function extractSeasonFromTitle(title: string): number | null {
  if (!title || typeof title !== 'string') return null;

  // Priority 1: Ordinal patterns with possible text between: "5ª 2/2 Temporada Final", "3º mitad Temporada"
  let match = title.match(/(\d{1,2})(?:ª|º)\s+.{0,20}?\b(?:temporada|temp\.?|season)\b/i);
  if (match) return parseInt(match[1], 10);

  // Standard ordinal without text between: "5ª Temporada", "3º Season"
  match = title.match(/(\d{1,2})(?:ª|º)\s*(?:temporada|temp\.?|season)/i);
  if (match) return parseInt(match[1], 10);

  // Reverse pattern: "Temporada 15ª", "Season 3º"
  match = title.match(/(?:temporada|temp\.?|season)\s*(\d{1,2})(?:ª|º)?/i);
  if (match) return parseInt(match[1], 10);

  // Priority 2: T-prefixed patterns: T1, T.1, T5ª, etc
  match = title.match(/\b[Tt]\.?(\d{1,2})/i);
  if (match) return parseInt(match[1], 10);

  // Priority 3: S-prefixed patterns: S1, Season 1, etc
  match = title.match(/\b[Ss](?:eason)?\s*(\d{1,2})/i);
  if (match) return parseInt(match[1], 10);

  return null;
}

/**
 * Extract total episode count from title string (helper for parsing).
 * Supports patterns like: [1/13], [13 de 13], (13), 13/13, etc.
 * Returns just the total episode count number, useful for comparison or formatting.
 * Returns null if no episode pattern found.
 *
 * @param title - The title string to parse
 * @returns Total episode count (1-300), or null if not found
 *
 * @example
 * extractEpisodeCountFromTitle("Breaking Bad T5 [16/16]") // 16
 * extractEpisodeCountFromTitle("Game S02 (10)") // 10
 * extractEpisodeCountFromTitle("No episodes") // null
 */
export function extractEpisodeCountFromTitle(title: string): number | null {
  if (!title || typeof title !== 'string') return null;

  // Pattern 1: [X/Y] format
  let match = title.match(/\[(\d+)\/(\d+)\]/);
  if (match) {
    const episodeCount = parseInt(match[2], 10);
    if (episodeCount >= 1 && episodeCount <= 300) return episodeCount;
  }

  // Pattern 2: (X) format
  match = title.match(/\((\d+)\)/);
  if (match) {
    const count = parseInt(match[1], 10);
    if (count > 100 || (count >= 1900 && count <= 2100)) return null;
    if (count >= 1 && count <= 300) return count;
  }

  // Pattern 3: X/Y format without brackets
  match = title.match(/\s(\d+)\/(\d+)\s/);
  if (match) {
    const episodeCount = parseInt(match[2], 10);
    if (episodeCount >= 1 && episodeCount <= 300) return episodeCount;
  }

  // Pattern 4: [X de Y] format (Spanish)
  match = title.match(/\[(\d+)\s+de\s+(\d+)\]/i);
  if (match) {
    const episodeCount = parseInt(match[2], 10);
    if (episodeCount >= 1 && episodeCount <= 300) return episodeCount;
  }

  return null;
}

/**
 * Extract episode numbers from title string.
 * Supports patterns like: [1/13], [13 de 13], (13), 13/13, 01,02,03, etc.
 * Returns comma-separated list "1,2,3,4,...,N" for season packs, or single number for standalone.
 * Returns null if no episode pattern found.
 *
 * @param title - The title string to parse (e.g., "Breaking Bad T5 [16/16]")
 * @returns Comma-separated episode list or single number, or null if not found
 *
 * @example
 * extractEpisodesFromTitle("Breaking Bad T5 [16/16]") // "1,2,3,...,16"
 * extractEpisodesFromTitle("Game S02 (10)") // "1,2,3,...,10"
 * extractEpisodesFromTitle("No episodes") // null
 */
export function extractEpisodesFromTitle(title: string): string | null {
  if (!title || typeof title !== 'string') return null;

  // Pattern 1: [X/Y] format (most common in forums) -> return list "1,2,...,Y"
  let match = title.match(/\[(\d+)\/(\d+)\]/);
  if (match) {
    const episodeCount = parseInt(match[2], 10);
    // Validate range 1-300
    if (episodeCount >= 1 && episodeCount <= 300) {
      return Array.from({ length: episodeCount }, (_, i) => i + 1).join(',');
    }
  }

  // Pattern 2: (X) format -> assume episode count
  // STRICT: Only accept if count is reasonable (< 100) to avoid matching years like (2015)
  match = title.match(/\((\d+)\)/);
  if (match) {
    const count = parseInt(match[1], 10);
    // If count > 100 or looks like year (19xx/20xx), ignore
    if (count > 100 || (count >= 1900 && count <= 2100)) return null;

    // If count > 1, assume it's total episode count for the season pack if explicitly small
    if (count > 1 && count <= 300) {
      return Array.from({ length: count }, (_, i) => i + 1).join(',');
    }
    if (count >= 1 && count <= 300) {
      return `${count}`;
    }
  }

  // Pattern 3: X/Y format without brackets (with spaces)
  match = title.match(/\s(\d+)\/(\d+)\s/);
  if (match) {
    const episodeCount = parseInt(match[2], 10);
    if (episodeCount >= 1 && episodeCount <= 300) {
      return Array.from({ length: episodeCount }, (_, i) => i + 1).join(',');
    }
  }

  // Pattern 4: [X de Y] format (Spanish)
  match = title.match(/\[(\d+)\s+de\s+(\d+)\]/i);
  if (match) {
    const episodeCount = parseInt(match[2], 10);
    if (episodeCount >= 1 && episodeCount <= 300) {
      return Array.from({ length: episodeCount }, (_, i) => i + 1).join(',');
    }
  }

  return null;
}