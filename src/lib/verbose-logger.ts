/**
 * Verbose Logger - Conditional logging based on environment variable
 * Set VERBOSE_LOGS=true in .env.local to enable verbose logging
 */

const VERBOSE_ENABLED = process.env.VERBOSE_LOGS === 'true';

export const verboseLog = {
  log: (...args: any[]) => {
    if (VERBOSE_ENABLED) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (VERBOSE_ENABLED) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Errors always show regardless of VERBOSE_LOGS
    console.error(...args);
  },
};
