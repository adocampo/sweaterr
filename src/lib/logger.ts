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

export type LogModule = 'forum' | 'search' | 'extract' | 'auth' | 'jdownloader' | 'cloudflare' | 'api' | 'testing' | 'db';

class Logger {
  private logToFile(module: LogModule, level: 'info' | 'warn' | 'error', message: string, data?: any) {
    // Only log to file on server side
    if (typeof window !== 'undefined') return;

    const timestamp = new Date().toISOString();
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
    // Only show essential info in console (skip 'db' to avoid query spam)
    if (process.env.NODE_ENV === 'development' && module !== 'db') {
      console.log(`[${module}] ${message}`);
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
