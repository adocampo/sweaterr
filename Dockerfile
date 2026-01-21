# Use Node.js 20 Debian Slim to ensure built-in File API support
FROM node:20-bookworm-slim

WORKDIR /app

# Install additional packages
RUN apt-get update && apt-get install -y --no-install-recommends wget openssl

# Copy package files
COPY package*.json ./

# Install dependencies and explicitly remove the z-ai-web-dev-sdk
RUN npm install && npm uninstall z-ai-web-dev-sdk || true

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Add Prisma CLI for migrations
RUN npm install -g prisma

# Copy Prisma schema
COPY prisma ./prisma

# Set environment variables
ENV NODE_ENV=dev
# Force Next.js to bind on all interfaces and avoid DNS lookup on random hostnames
ENV HOSTNAME=0.0.0.0
ENV HOST=0.0.0.0
ENV PORT=3000

# Important: Configure these at runtime via docker-compose.yml or kubernetes secrets:
# - DATABASE_URL (required)
# - JWT_SECRET (required for authentication)
# - FLARESOLVERR_URL (required)

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Create startup script
RUN echo '#!/bin/sh\n\
    echo "Running Prisma migrations..."\n\
    npx prisma migrate deploy || npx prisma db push\n\
    echo "Starting application..."\n\
    exec npm start' > /app/start.sh && chmod +x /app/start.sh

# Start the application
CMD ["/app/start.sh"]