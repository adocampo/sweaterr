#!/usr/bin/env node

/**
 * Custom production server for Sweaterr.
 *
 * Why this exists:
 * - Next.js 15.3.5 has a Docker production streaming bug that can return empty bodies
 *   with `Transfer-Encoding: chunked` when using `next start`.
 * - We avoid `next start` entirely and instead:
 *   1) Serve prerendered HTML from `.next/server/app/*.html`
 *   2) Execute compiled app-route modules from `.next/server/app/<route>/route.js` for:
 *      - API endpoints under `/api/...`
 *      - special assets like `/icon.png` and `/favicon.ico`
 *   3) Serve `/_next/*` assets from `.next/*` and public files from `public/*`
 *
 * This keeps Docker responses non-empty and supports POST requests (setup/login).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

// Ensure production mode for route handlers
process.env.NODE_ENV = 'production';

function resolveDataDir() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  const filePrefix = 'file:';
  if (databaseUrl.startsWith(filePrefix)) {
    const dbPath = databaseUrl.slice(filePrefix.length);
    if (dbPath) return path.dirname(dbPath);
  }

  // Fallbacks: prefer bind-mounted ./data (Docker) if present.
  const localDataDir = path.join(__dirname, 'data');
  if (fs.existsSync(localDataDir)) return localDataDir;
  return __dirname;
}

function fingerprintSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 12);
}

function ensureJwtSecret() {
  const current = (process.env.JWT_SECRET || '').trim();
  if (current) {
    console.log('[Auth] JWT_SECRET set (fingerprint):', fingerprintSecret(current));
    return;
  }

  const dataDir = resolveDataDir();
  const secretFile = path.join(dataDir, '.jwt_secret');

  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    console.warn('[Auth] Could not ensure data directory exists:', dataDir, e);
  }

  try {
    if (fs.existsSync(secretFile)) {
      const fromFile = fs.readFileSync(secretFile, 'utf8').trim();
      if (fromFile) {
        process.env.JWT_SECRET = fromFile;
        console.log('[Auth] JWT_SECRET loaded from volume (fingerprint):', fingerprintSecret(fromFile));
        return;
      }
    }
  } catch (e) {
    console.warn('[Auth] Could not read JWT secret file:', secretFile, e);
  }

  const generated = crypto.randomBytes(48).toString('base64');
  process.env.JWT_SECRET = generated;

  try {
    fs.writeFileSync(secretFile, `${generated}\n`, { encoding: 'utf8', mode: 0o600 });
    console.log('[Auth] JWT_SECRET generated and persisted (fingerprint):', fingerprintSecret(generated));
  } catch (e) {
    console.warn('[Auth] JWT_SECRET generated but could not be persisted. Tokens will break on restart.', e);
  }
}

ensureJwtSecret();

const NEXT_DIR = path.join(__dirname, '.next');
const NEXT_APP_DIR = path.join(NEXT_DIR, 'server', 'app');
const PUBLIC_DIR = path.join(__dirname, 'public');

const routeExportsCache = new Map();

async function loadCompiledRouteExports(filePath) {
  if (routeExportsCache.has(filePath)) return routeExportsCache.get(filePath);

  let loaded;
  try {
    loaded = require(filePath);
  } catch (e) {
    throw e;
  }

  // Next.js compiled app-route bundles can export a thenable (webpack runtime loader).
  // Resolve it once and cache the resolved exports object.
  const resolvedPromise = Promise.resolve(loaded).catch((e) => {
    routeExportsCache.delete(filePath);
    throw e;
  });

  routeExportsCache.set(filePath, resolvedPromise);
  return resolvedPromise;
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml; charset=utf-8';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function sendBuffer(res, statusCode, headers, buffer) {
  res.statusCode = statusCode;
  for (const [key, value] of Object.entries(headers || {})) {
    if (value === undefined) continue;
    res.setHeader(key, value);
  }
  if (Buffer.isBuffer(buffer)) {
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
    return;
  }
  const out = Buffer.from(buffer || '');
  res.setHeader('Content-Length', String(out.length));
  res.end(out);
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function normalizePathname(pathname) {
  // Ensure leading slash, drop trailing slash (except root)
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  return pathname;
}

function resolveHtmlFile(pathname) {
  const normalized = normalizePathname(pathname);
  if (normalized === '/') return path.join(NEXT_APP_DIR, 'index.html');
  // Next emits flat HTML files for static routes: login.html, setup.html, ...
  const flat = path.join(NEXT_APP_DIR, `${normalized.slice(1)}.html`);
  if (fileExists(flat)) return flat;
  // Fallback: nested index.html (just in case)
  const nested = path.join(NEXT_APP_DIR, normalized.slice(1), 'index.html');
  if (fileExists(nested)) return nested;
  return null;
}

function resolveRouteModuleFile(pathname) {
  const normalized = normalizePathname(pathname);
  // API routes live under /app/.next/server/app/api/**/route.js
  // special assets like /icon.png live under /app/.next/server/app/icon.png/route.js
  const candidate = path.join(NEXT_APP_DIR, normalized.slice(1), 'route.js');
  if (fileExists(candidate)) return { filePath: candidate, params: {} };

  // Dynamic segment resolution: walk directories and match [param]
  const segments = normalized.split('/').filter(Boolean);
  let currentDir = NEXT_APP_DIR;
  const params = {};
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const exactDir = path.join(currentDir, seg);
    if (fileExists(exactDir) && fs.statSync(exactDir).isDirectory()) {
      currentDir = exactDir;
      continue;
    }

    // Try [param] or [...param]
    let matchedDir = null;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      const m = name.match(/^\[(\.\.\.)?(.+?)\]$/);
      if (!m) continue;
      matchedDir = path.join(currentDir, name);
      const isCatchAll = Boolean(m[1]);
      const paramName = m[2];
      if (isCatchAll) {
        params[paramName] = segments.slice(i).join('/');
        currentDir = matchedDir;
        i = segments.length; // stop walking
      } else {
        params[paramName] = seg;
        currentDir = matchedDir;
      }
      break;
    }
    if (!matchedDir) return null;
  }

  const finalCandidate = path.join(currentDir, 'route.js');
  if (fileExists(finalCandidate)) return { filePath: finalCandidate, params };
  return null;
}

async function executeCompiledRoute(req, res, routeInfo, baseUrl) {
  let NextRequest;
  try {
    // Lazy-load to keep startup fast
    ({ NextRequest } = require('next/server'));
  } catch (e) {
    console.error('[server] Failed to import NextRequest from next/server:', e);
    sendBuffer(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Server misconfiguration\n');
    return;
  }

  const method = (req.method || 'GET').toUpperCase();

  let bodyBuffer = null;
  if (!['GET', 'HEAD'].includes(method)) {
    bodyBuffer = await readRequestBody(req);
  }

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(','));
  }

  const init = {
    method,
    headers,
  };
  if (bodyBuffer && bodyBuffer.length > 0) {
    init.body = bodyBuffer;
  }

  const requestUrl = new URL(req.url || '/', baseUrl).toString();
  const nextReq = new NextRequest(requestUrl, init);

  let mod;
  try {
    mod = await loadCompiledRouteExports(routeInfo.filePath);
  } catch (e) {
    console.error('[server] Failed to require route module:', routeInfo.filePath, e);
    sendBuffer(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Failed to load route module\n');
    return;
  }

  const HTTP_METHODS = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const candidateUserlands = [];
  if (mod?.routeModule?.userland && typeof mod.routeModule.userland === 'object') candidateUserlands.push(mod.routeModule.userland);
  if (mod?.userland && typeof mod.userland === 'object') candidateUserlands.push(mod.userland);
  if (mod?.default && typeof mod.default === 'object') candidateUserlands.push(mod.default);
  if (mod && typeof mod === 'object') candidateUserlands.push(mod);

  let userland = null;
  let handler = null;
  for (const candidate of candidateUserlands) {
    const maybeHandler = candidate?.[method];
    if (typeof maybeHandler === 'function') {
      userland = candidate;
      handler = maybeHandler;
      break;
    }
  }

  if (typeof handler !== 'function') {
    const allowed = [];
    for (const candidate of candidateUserlands) {
      for (const m of HTTP_METHODS) {
        if (typeof candidate?.[m] === 'function' && !allowed.includes(m)) allowed.push(m);
      }
    }

    res.statusCode = 405;
    res.setHeader('Allow', allowed.join(', '));
    sendBuffer(res, 405, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    return;
  }

  let response;
  try {
    if (handler.length >= 2) {
      response = await handler(nextReq, { params: routeInfo.params || {} });
    } else if (handler.length === 1) {
      response = await handler(nextReq);
    } else {
      response = await handler();
    }
  } catch (e) {
    console.error('[server] Route handler error:', routeInfo.filePath, e);
    sendBuffer(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ success: false, error: 'Internal Server Error' }));
    return;
  }

  // Copy status + headers
  const outHeaders = {};
  try {
    for (const [k, v] of response.headers.entries()) {
      // set-cookie handled separately below
      if (k.toLowerCase() === 'set-cookie') continue;
      outHeaders[k] = v;
    }
    // Multi Set-Cookie support (undici)
    if (typeof response.headers.getSetCookie === 'function') {
      const cookies = response.headers.getSetCookie();
      if (cookies && cookies.length > 0) {
        res.setHeader('Set-Cookie', cookies);
      }
    } else {
      const cookie = response.headers.get('set-cookie');
      if (cookie) res.setHeader('Set-Cookie', cookie);
    }
  } catch {
    // ignore header copy errors
  }

  let payload;
  try {
    const ab = await response.arrayBuffer();
    payload = Buffer.from(ab);
  } catch {
    payload = Buffer.from('');
  }

  sendBuffer(res, response.status || 200, outHeaders, payload);
}

function serveFile(res, filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    sendBuffer(res, 200, { 'Content-Type': getContentType(filePath) }, buf);
  } catch (e) {
    console.error('[server] Failed to read file:', filePath, e);
    sendBuffer(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Failed to read file\n');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const baseUrl = `http://${req.headers.host || `localhost:${PORT}`}`;
    const urlObj = new URL(req.url || '/', baseUrl);
    const pathname = normalizePathname(urlObj.pathname);

    // 1) Serve Next static assets
    if (pathname.startsWith('/_next/')) {
      const rel = pathname.replace(/^\/_next\//, '');
      const staticFile = path.join(NEXT_DIR, rel);
      if (fileExists(staticFile) && fs.statSync(staticFile).isFile()) {
        serveFile(res, staticFile);
        return;
      }
    }

    // 2) Serve public files
    const publicFile = path.join(PUBLIC_DIR, pathname.slice(1));
    if (fileExists(publicFile) && fs.statSync(publicFile).isFile()) {
      serveFile(res, publicFile);
      return;
    }

    // 3) Serve prerendered HTML
    const htmlFile = resolveHtmlFile(pathname);
    if (htmlFile) {
      serveFile(res, htmlFile);
      return;
    }

    // 4) Execute compiled route modules (API + special assets)
    const routeInfo = resolveRouteModuleFile(pathname);
    if (routeInfo) {
      await executeCompiledRoute(req, res, routeInfo, baseUrl);
      return;
    }

    // 404
    sendBuffer(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found\n');
  } catch (e) {
    console.error('[server] Unhandled error:', e);
    sendBuffer(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Internal Server Error\n');
  }
});

if (!fileExists(NEXT_DIR) || !fileExists(NEXT_APP_DIR)) {
  console.error('[server] ERROR: Build output not found. Expected .next/server/app to exist.');
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`[server] Listening on http://${HOST}:${PORT}`);
  console.log(`[server] Using build from: ${NEXT_DIR}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
