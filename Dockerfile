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

# Copy entrypoint script (avoids heredoc issues in Dockerfile)
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create data directory (will be overridden by volume mount, but ensures it exists)
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const http=require('http');const t=setTimeout(()=>process.exit(1),5000);http.get('http://localhost:3000/api/health',(r)=>{clearTimeout(t);process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# Start the application via entrypoint script
CMD ["/app/docker-entrypoint.sh"]