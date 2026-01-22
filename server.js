const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

// Simple router for common routes
function routeRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Health check endpoint
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }));
    return;
  }

  // Debug endpoint
  if (pathname === '/api/debug') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Debug response - plain text\n');
    return;
  }

  // Try to serve static files or prerendered HTML
  const nextServerPath = path.join(process.cwd(), '.next', 'server', 'app');
  
  // Determine which file to serve
  let filePath;
  if (pathname === '/') {
    filePath = path.join(nextServerPath, 'index.html');
  } else {
    filePath = path.join(nextServerPath, pathname + '.html');
    // Try without .html if not found
    if (!fs.existsSync(filePath)) {
      filePath = path.join(nextServerPath, pathname, 'index.html');
    }
  }

  // Try to serve HTML file
  if (fs.existsSync(filePath) && filePath.endsWith('.html')) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
      return;
    } catch (err) {
      console.error('Error reading HTML file:', err);
    }
  }

  // Try to serve static assets from .next/static
  if (pathname.startsWith('/_next/')) {
    const staticPath = path.join(process.cwd(), '.next', pathname.slice(6));
    try {
      if (fs.existsSync(staticPath)) {
        const content = fs.readFileSync(staticPath);
        const ext = path.extname(staticPath);
        let contentType = 'application/octet-stream';
        
        if (ext === '.js') contentType = 'application/javascript';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.json') contentType = 'application/json';
        if (ext === '.woff') contentType = 'font/woff';
        if (ext === '.woff2') contentType = 'font/woff2';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return;
      }
    } catch (err) {
      console.error('Error reading static file:', err);
    }
  }

  // Serve public static files
  if (!pathname.startsWith('/api/')) {
    const publicPath = path.join(process.cwd(), 'public', pathname);
    try {
      if (fs.existsSync(publicPath)) {
        const content = fs.readFileSync(publicPath);
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(content);
        return;
      }
    } catch (err) {
      console.error('Error reading public file:', err);
    }
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 - Page Not Found</h1></body></html>');
}

const server = http.createServer((req, res) => {
  // Add CORS headers to prevent issues
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  routeRequest(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Express server listening on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
