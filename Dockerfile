# Use Node.js 20 Debian Slim to ensure built-in File API support
FROM node:20-bookworm-slim

WORKDIR /app

# Build args for UID/GID mapping (default: 1000)
ARG UID=1000
ARG GID=1000

# Install additional packages (tzdata for TZ support via environment variable)
RUN apt-get update && apt-get install -y --no-install-recommends wget openssl tzdata

# Create non-root user with custom UID/GID
# Use different GID if 1000 already exists, to avoid conflicts
RUN groupadd -g ${GID} sweaterr 2>/dev/null || groupadd sweaterr && \
    useradd -m -u ${UID} -g sweaterr sweaterr 2>/dev/null || useradd -m -g sweaterr sweaterr || true

# Copy package files
COPY package*.json ./

# Install dependencies and explicitly remove the z-ai-web-dev-sdk
RUN npm install && npm uninstall z-ai-web-dev-sdk || true

# Copy source code EARLY to include prisma schema and ensure all files are present
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application (require JWT_SECRET for Next.js build, can be any value)
RUN JWT_SECRET="build-time-secret-not-used-in-runtime" npm run build

# Set environment variables
ENV NODE_ENV=production
# Force Next.js to bind on all interfaces and avoid DNS lookup on random hostnames
ENV HOSTNAME=0.0.0.0
ENV HOST=0.0.0.0
ENV PORT=3000

# Important: Configure these at runtime via docker-compose.yml or kubernetes secrets:
# - DATABASE_URL (required)
# - JWT_SECRET (required for authentication)
# - FLARESOLVERR_URL (required)

# Create startup script that fixes data directory permissions before running the app
# This handles Docker volumes mounted from host with any ownership
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
if [ -n "$TZ" ] && [ -f "/usr/share/zoneinfo/$TZ" ]; then
  export TZ
fi

# Fix data directory permissions to match container user
# This handles volumes mounted from host with different ownership
if [ -d "/app/data" ]; then
  chown -R ${UID}:${GID} /app/data 2>/dev/null || true
  chmod -R 755 /app/data 2>/dev/null || true
fi

echo "Applying database migrations..."
npx prisma migrate deploy || {
  echo "Migration deploy failed, falling back to db push..."
  npx prisma db push --accept-data-loss || {
    echo "ERROR: Failed to apply database schema"
    exit 1
  }
}
echo "Starting application..."
exec node /app/server.js
EOF

RUN chmod +x /app/start.sh

# Create data directory (will be overridden by volume mount, but ensures it exists)
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start the application via startup script
CMD ["/app/start.sh"]