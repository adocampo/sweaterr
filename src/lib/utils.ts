import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const APP_NAME = 'Sweaterr'
export const APP_VERSION = '1.6.3'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
