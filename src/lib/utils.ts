import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const APP_NAME = 'Sweaterr'
export const APP_VERSION = '1.0.5'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
