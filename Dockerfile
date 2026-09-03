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

# Create startup script BEFORE switching to non-root user (so we can write to /app)
# This script respects TZ env via environment variable
# Uses prisma db push for first-run migration (works with existing DBs)
# Then prisma migrate deploy for subsequent runs (respects migration history)
RUN echo '#!/bin/sh\n\
    if [ -n "$TZ" ] && [ -f "/usr/share/zoneinfo/$TZ" ]; then\n\
    export TZ\n\
    fi\n\
    echo "Applying database schema..."\n\
    if npx prisma migrate deploy 2>/dev/null; then\n\
      echo "Migration history applied"\n\
    else\n\
      echo "No migration history found, pushing schema..."\n\
      npx prisma db push || {\n\
        echo "ERROR: Failed to apply database schema"\n\
        exit 1\n\
      }\n\
    fi\n\
    echo "Starting application..."\n\
    exec node /app/server.js' > /app/start.sh && chmod +x /app/start.sh

# Create data directory with correct permissions
RUN mkdir -p /app/data && chown -R ${UID}:${GID} /app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Switch to non-root user (AFTER creating files that need root permissions)
USER sweaterr

# Start the application
CMD ["/app/start.sh"]