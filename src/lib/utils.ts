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
  const match = title.match(/(\d+(?:\.\d+)?)\s*(TB|GB|MB|B|TiB|GiB|MiB|KiB)/i);

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
