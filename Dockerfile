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

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/app.db"
ENV NEXTAUTH_SECRET="your-secret-key-change-in-production"
# Force Next.js to bind on all interfaces and avoid DNS lookup on random hostnames
ENV HOSTNAME=0.0.0.0
ENV HOST=0.0.0.0
ENV PORT=3000

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]