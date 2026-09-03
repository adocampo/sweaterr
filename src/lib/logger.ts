import fs from 'fs';
import path from 'path';

// Use process.cwd() to get the project root directory (where package.json is)
const projectRoot = process.cwd();
const logsDir = path.join(projectRoot, 'logs');

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

export type LogModule =
  | 'forum'
  | 'search'
  | 'extract'
  | 'auth'
  | 'jdownloader'
  | 'cloudflare'
  | 'flaresolverr'
  | 'api'
  | 'sabnzbd'
  | 'testing'
  | 'db'
  | 'metadata'
  | 'arr_caps'
  | 'arr_grab'
  | 'arr-notify'
  | 'qbittorrent';

/** Keys whose value must never reach a log file. */
const SENSITIVE_KEY = /(password|passwd|token|secret|api[-_]?key|authorization|cookie|clearance|sessionhash)/i;

/**
 * `JSON.stringify(new Error(...))` yields `{}`, which hides every failure cause.
 * Axios errors get summarised instead of dumped: their `config` carries the full
 * request payload, which for us includes session cookies.
 */
function describeError(error: any): string {
  const parts = [`${error.name}: ${error.message}`];
  if (error.code) parts.push(`code=${error.code}`);

  const response = error.response;
  if (response) {
    parts.push(`status=${response.status}`);
    const body = typeof response.data === 'string' ? response.data : formatData(response.data);
    if (body) parts.push(`body=${body.slice(0, 500)}`);
  }

  const config = error.config;
  if (config?.url) parts.push(`request=${String(config.method || 'get').toUpperCase()} ${config.url}`);
  if (error.stack) parts.push(error.stack);

  return parts.join(' | ');
}

function formatData(data: any): string {
  if (data instanceof Error) return describeError(data);
  if (typeof data !== 'object' || data === null) return String(data);

  try {
    return JSON.stringify(
      data,
      (key, value) => {
        if (SENSITIVE_KEY.test(key)) return '[redacted]';
        if (value instanceof Error) return describeError(value);
        return value;
      },
      2
    );
  } catch {
    return String(data);
  }
}

/** The full payload goes to the file; the console only needs the headline. */
function consoleSuffix(data: any): string {
  if (data === undefined) return '';
  const text = formatData(data).split('\n')[0];
  return ` ${text.length > 400 ? `${text.slice(0, 400)}…` : text}`;
}

class Logger {
  private readonly maxLogLinesToKeep = 1000;
  // Upper bound for how many bytes we will read from the end of a log file when rotating.
  // This avoids loading multi-GB logs into memory (and hitting Node's string limits).
  private readonly maxRotateReadBytes = 8 * 1024 * 1024; // 8 MiB
  private readonly rotateReadBlockSize = 64 * 1024; // 64 KiB

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
      logLine += ` ${formatData(data)}`;
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
    // Always show in console for critical modules (FlareSolverr, Cloudflare, etc.)
    if (process.env.NODE_ENV === 'development' && module !== 'db' && module !== 'search' && module !== 'jdownloader') {
      console.log(`[${module}] ${message}`);
    } else if (process.env.NODE_ENV === 'production' && ['flaresolverr', 'cloudflare', 'api', 'auth', 'arr_caps', 'arr_grab'].includes(module)) {
      console.log(`[${module}] [INFO] ${message}`);
    }
  }

  debug(module: LogModule, message: string, data?: any) {
    // Debug goes to file and console for critical modules in production
    this.logToFile(module, 'debug', message, data);
    if (process.env.NODE_ENV === 'development' && module !== 'db' && module !== 'jdownloader') {
      console.debug(`[${module}] ${message}`);
    } else if (process.env.NODE_ENV === 'production' && ['flaresolverr', 'cloudflare', 'api', 'auth'].includes(module)) {
      console.log(`[${module}] [DEBUG] ${message}`);
    }
  }

  warn(module: LogModule, message: string, data?: any) {
    this.logToFile(module, 'warn', message, data);
    console.warn(`[${module}] ⚠ ${message}${consoleSuffix(data)}`);
  }

  error(module: LogModule, message: string, data?: any) {
    this.logToFile(module, 'error', message, data);
    console.error(`[${module}] ✗ ${message}${consoleSuffix(data)}`);
  }

  // Clear old logs (keep last 1000 lines per file)
  rotateLogs() {
    try {
      const files = fs.readdirSync(logsDir);
      files.forEach(file => {
        if (!file.endsWith('.log')) return;

        const filePath = path.join(logsDir, file);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return;

        const readAllSafely = stat.size <= this.maxRotateReadBytes;

        const tailContent = readAllSafely
          ? fs.readFileSync(filePath, 'utf-8')
          : this.readTailUtf8(filePath, this.maxRotateReadBytes);

        const lines = tailContent.split('\n');
        if (lines.length > this.maxLogLinesToKeep) {
          const kept = lines.slice(-this.maxLogLinesToKeep);
          fs.writeFileSync(filePath, kept.join('\n'));
          return;
        }

        // If the file is huge but the tail doesn't contain enough newlines (e.g., very long lines),
        // still truncate it to the tail we read to prevent unbounded growth.
        if (!readAllSafely && stat.size > this.maxRotateReadBytes) {
          fs.writeFileSync(filePath, tailContent);
        }
      });
    } catch (err) {
      console.error('Failed to rotate logs:', err);
    }
  }

  private readTailUtf8(filePath: string, maxBytes: number): string {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return '';
    if (stat.size <= 0) return '';

    const fd = fs.openSync(filePath, 'r');
    try {
      const fileSize = stat.size;
      let position = fileSize;
      let bytesRemaining = Math.min(fileSize, maxBytes);
      let newlineCount = 0;

      const chunks: Buffer[] = [];

      while (bytesRemaining > 0 && newlineCount < this.maxLogLinesToKeep + 1) {
        const toRead = Math.min(this.rotateReadBlockSize, bytesRemaining);
        position -= toRead;

        const buffer = Buffer.allocUnsafe(toRead);
        const bytesRead = fs.readSync(fd, buffer, 0, toRead, position);
        if (bytesRead <= 0) break;

        const slice = bytesRead === toRead ? buffer : buffer.subarray(0, bytesRead);
        chunks.unshift(slice);

        for (let i = 0; i < slice.length; i++) {
          if (slice[i] === 10) newlineCount++;
        }

        bytesRemaining -= bytesRead;
      }

      return Buffer.concat(chunks).toString('utf-8');
    } finally {
      fs.closeSync(fd);
    }
  }
}

export const logger = new Logger();

// Rotate logs on startup
logger.rotateLogs();
