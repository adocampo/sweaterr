# Development Guide for Sweaterr with Docker

This guide explains how to set up and develop Sweaterr using Docker with proper volume management for the database and code.

## Quick Start (Production Mode)

```bash
# Set environment variables
export JWT_SECRET=$(openssl rand -base64 32)
export FLARESOLVERR_URL="http://192.168.1.100:8191"  # Update with your IP

# Start services
docker-compose up -d

# Access at http://localhost:3000
```

## Development Setup

### 1. Using Docker Compose with Volumes

The `docker-compose.yml` is configured with:

- **Database Volume** (`sweaterr-db`): Persists the SQLite database across container restarts
- **Prisma Schema Mount** (`./prisma:/app/prisma:ro`): Makes schema accessible for inspection

```bash
# Start in development mode
export JWT_SECRET=$(openssl rand -base64 32)
export FLARESOLVERR_URL="http://192.168.1.100:8191"

docker-compose up -d

# Check logs
docker-compose logs -f sweaterr

# Stop
docker-compose down

# Clean up (removes volume - data will be lost)
docker-compose down -v
```

### 2. Enable Hot-Reload for Development

If you want to develop with hot-reload enabled in Docker, uncomment the volumes section in `docker-compose.yml`:

```yaml
volumes:
  # Database persistence
  - ./prisma:/app/prisma:ro
  - sweaterr-db:/app/data
  # Development with live reload (uncomment below)
  - .:/app
  - /app/node_modules      # Don't mount this - keep container's node_modules
  - /app/.next              # Don't mount this - keep container's build cache
```

Then restart:

```bash
docker-compose down
docker-compose up -d --build

# Watch logs for changes
docker-compose logs -f sweaterr
```

### 3. Local Development (Without Docker)

For faster development iterations, run locally:

```bash
# Install dependencies
npm install

# Set environment variables
export JWT_SECRET=$(openssl rand -base64 32)
export DATABASE_URL="file:./prisma/dev.db"
export FLARESOLVERR_URL="http://192.168.1.100:8191"

# Run migrations
npx prisma migrate dev

# Start dev server
npm run dev

# Access at http://localhost:3000
```

## Database Management

### Backup Database

```bash
# Docker
docker-compose exec sweaterr cp /app/data/dev.db /app/data/dev.db.backup

# Or directly
cp prisma/dev.db prisma/dev.db.backup
```

### Reset Database

```bash
# Stop container
docker-compose down

# Remove volume (WARNING: data will be lost)
docker volume rm sweaterr_sweaterr-db

# Restart
docker-compose up -d
```

### Inspect Database

```bash
# Using Prisma Studio (local only)
npm run prisma:studio

# Or access SQLite directly
sqlite3 prisma/dev.db

# View Prisma logs
docker-compose exec sweaterr cat /app/server.log
```

## Environment Variables

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens (generate with `openssl rand -base64 32`) | `abcdef...` |
| `FLARESOLVERR_URL` | URL to FlareSolverr service for Cloudflare bypass | `http://flaresolverr:8191` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for metadata extraction | - |
| `DEEPSEEK_API_KEY` | DeepSeek API key | - |
| `PERPLEXITY_API_KEY` | Perplexity API key | - |
| `NODE_ENV` | Environment mode | `production` |

## Volume Management

### Database Volume (`sweaterr-db`)

- **Purpose**: Persists the SQLite database
- **Location in Container**: `/app/data/dev.db`
- **Local Path**: Docker managed volume (run `docker volume ls` to see location)
- **Backup**: Container database is separate from local database

To access the volume:

```bash
# List volumes
docker volume ls | grep sweaterr

# Inspect volume location
docker volume inspect sweaterr_sweaterr-db

# Mount and backup
docker run --rm -v sweaterr_sweaterr-db:/data -v $(pwd):/backup \
  alpine cp /data/dev.db /backup/dev.db.backup
```

## Troubleshooting

### Database Not Persisting

```bash
# Check if volume is properly mounted
docker inspect sweaterr | grep Mounts -A 10

# Verify volume exists
docker volume ls | grep sweaterr

# Rebuild with volume
docker-compose down -v
docker-compose up -d --build
```

### Changes Not Reflecting

```bash
# If using hot-reload mounted volumes:
# 1. Check file permissions
ls -la src/

# 2. Rebuild Docker image
docker-compose down
docker-compose up -d --build

# 3. Clear Next.js cache
docker-compose exec sweaterr rm -rf /app/.next
docker-compose restart sweaterr
```

### Port Already in Use

```bash
# Change port in docker-compose.yml
# From: "3000:3000"
# To:   "3001:3000"

# Or find what's using port 3000
lsof -i :3000
kill -9 <PID>
```

## Useful Commands

```bash
# View logs
docker-compose logs -f sweaterr

# Access container shell
docker-compose exec sweaterr bash

# Run Prisma commands
docker-compose exec sweaterr npx prisma studio
docker-compose exec sweaterr npx prisma migrate status

# Check health
docker-compose exec sweaterr wget --spider http://localhost:3000/api/health

# Restart service
docker-compose restart sweaterr

# Remove everything (including volumes)
docker-compose down -v

# Rebuild image
docker-compose build --no-cache

# View resource usage
docker stats sweaterr
```

## Production Deployment

For production:

1. Set strong `JWT_SECRET`: `openssl rand -base64 32`
2. Set correct `FLARESOLVERR_URL` (use stable hostname or IP)
3. Change `NODE_ENV` to `production`
4. Set up proper database backup strategy (the volume is persistent but not replicated)
5. Use a reverse proxy (nginx/Caddy) for SSL/TLS
6. Configure health checks appropriately

See `docker-compose.yml` for optional nginx configuration.
