import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist (only on server)
if (typeof window === 'undefined') {
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log(`[Logger] Created logs directory: ${logsDir}`);
    }
  } catch (err) {
    console.error('[Logger] Failed to create logs directory:', err);
  }
}

export type LogModule = 'forum' | 'search' | 'extract' | 'auth' | 'jdownloader' | 'cloudflare' | 'api' | 'testing' | 'db' | 'metadata';

class Logger {
  private formatLocalTimestamp() {
    const date = new Date();

    const pad = (value: number) => value.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);
    const offset = `${sign}${offsetHours}:${offsetMins}`;

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zoneSuffix = timeZone ? ` ${timeZone}` : '';

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${offset}${zoneSuffix}`;
  }

  private logToFile(module: LogModule, level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
    // Only log to file on server side
    if (typeof window !== 'undefined') return;

    const timestamp = this.formatLocalTimestamp();
    const logFile = path.join(logsDir, `${module}.log`);

    let logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (data !== undefined) {
      logLine += ` ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`;
    }
    logLine += '\n';

    try {
      fs.appendFileSync(logFile, logLine);
    } catch (err) {
      console.error(`Failed to write to ${module}.log:`, err);
    }
  }

  info(module: LogModule, message: string, data?: any) {
    this.logToFile(module, 'info', message, data);
    // Only show essential info in console (skip noisy modules)
    if (process.env.NODE_ENV === 'development' && module !== 'db' && module !== 'search' && module !== 'jdownloader') {
      console.log(`[${module}] ${message}`);
    }
  }

  debug(module: LogModule, message: string, data?: any) {
    // Debug goes to file to keep console clean and avoid breaking callers
    this.logToFile(module, 'debug', message, data);
    if (process.env.NODE_ENV === 'development' && module !== 'db' && module !== 'jdownloader') {
      console.debug(`[${module}] ${message}`);
    }
  }

  warn(module: LogModule, message: string, data?: any) {
    this.logToFile(module, 'warn', message, data);
    console.warn(`[${module}] ⚠ ${message}`);
  }

  error(module: LogModule, message: string, data?: any) {
    this.logToFile(module, 'error', message, data);
    console.error(`[${module}] ✗ ${message}`);
  }

  // Clear old logs (keep last 1000 lines per file)
  rotateLogs() {
    try {
      const files = fs.readdirSync(logsDir);
      files.forEach(file => {
        if (!file.endsWith('.log')) return;

        const filePath = path.join(logsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        if (lines.length > 1000) {
          const kept = lines.slice(-1000);
          fs.writeFileSync(filePath, kept.join('\n'));
        }
      });
    } catch (err) {
      console.error('Failed to rotate logs:', err);
    }
  }
}

export const logger = new Logger();

// Rotate logs on startup
logger.rotateLogs();
