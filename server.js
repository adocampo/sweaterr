#!/usr/bin/env node

/**
 * Production server wrapper for Next.js
 * This file ensures proper environment setup and then delegates to npm start
 * which runs the built-in Next.js server (next start)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.HOST = process.env.HOST || '0.0.0.0';

console.log('[server.js] Starting Next.js server in production mode...');
console.log(`[server.js] Environment: ${process.env.NODE_ENV}`);
console.log(`[server.js] PORT: ${process.env.PORT}`);
console.log(`[server.js] HOST: ${process.env.HOST}`);

// Verify that the application has been built
const nextDir = path.join(__dirname, '.next');
if (!fs.existsSync(nextDir)) {
  console.error('[server.js] ERROR: .next directory not found. Please run: npm run build');
  process.exit(1);
}

// Run next start which handles all routing, middleware, and API routes correctly
try {
  console.log('[server.js] Running: npm start');
  execSync('npm start', {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });
} catch (error) {
  console.error('[server.js] Failed to start server:', error.message);
  process.exit(1);
}
