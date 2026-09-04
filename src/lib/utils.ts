import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { readFileSync } from 'fs'
import { join } from 'path'

export const APP_NAME = 'Sweaterr'

// Read version dynamically from package.json at build time
let APP_VERSION = '0.0.0'
try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'))
    APP_VERSION = pkg.version || '0.0.0'
} catch {
    // Fallback if package.json can't be read
}

export { APP_VERSION }
export const APP_NAME = 'Sweaterr'

// Read version dynamically from package.json at build time
let APP_VERSION = '0.0.0'
try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'))
    APP_VERSION = pkg.version || '0.0.0'
} catch {
    // Fallback if package.json can't be read
}

export { APP_VERSION }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
