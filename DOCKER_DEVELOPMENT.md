# Docker and Development Guide for Sweaterr

This guide covers three ways to run Sweaterr:
1. **Docker Compose** (recommended for production/testing) - Full containerized setup
2. **Docker CLI** (for manual control) - Single container with docker run
3. **Local Development** (fastest iteration) - Node.js directly on your machine

## Quick Start Comparison

| Method | Speed | Persistence | Hot-Reload | Best For |
|--------|-------|-------------|-----------|----------|
| Local Dev | ⚡⚡⚡ Fast | Manual | ✅ Yes | Active development |
| Docker Compose | ⚡⚡ Medium | ✅ Bind mount | ❌ No (configurable) | Production testing |
| Docker CLI | ⚡⚡ Medium | ✅ Bind mount | ❌ No | Manual control |

---

## 1. Local Development (Recommended for Development)

### Setup

```bash
# Install dependencies
npm install

# Create data directory
mkdir -p data

# Set environment variables
export JWT_SECRET=$(openssl rand -base64 32)
export DATABASE_URL="file:./prisma/dev.db"
export FLARESOLVERR_URL="http://192.168.1.100:8191"  # Update with your IP

# Setup database
npx prisma migrate dev
```

### Running

```bash
# Start dev server with hot-reload (watches for file changes)
npm run dev

# Access at http://localhost:3000

# In another terminal, optionally open Prisma Studio
npm run prisma:studio
```

### Database Management (Local)

```bash
# View database in Prisma Studio
npm run prisma:studio

# Reset database (⚠️ WARNING: deletes all data)
npx prisma migrate reset --force

# Backup database
cp prisma/dev.db prisma/dev.db.backup

# Restore from backup
cp prisma/dev.db.backup prisma/dev.db
```

### Advantages

✅ **Instant hot-reload** - Changes appear immediately
✅ **Direct file access** - Edit code and see results instantly
✅ **Easy debugging** - Use browser DevTools and Node debugger
✅ **Direct database access** - `sqlite3 prisma/dev.db` or Prisma Studio
✅ **Full control** - Can see all logs and errors directly

---

## 2. Docker Compose (Recommended for Production-like Testing)

### Installation

```bash
# Docker Compose comes with Docker Desktop
# For Linux, install separately: https://docs.docker.com/compose/install/
```

### Setup

```bash
# Navigate to project directory
cd /path/to/sweaterr

# Create data directory for bind mount
mkdir -p data

# Set environment variables (create a `.env.local` file)
cat > .env.local << 'EOF'
JWT_SECRET=$(openssl rand -base64 32)
FLARESOLVERR_URL=http://192.168.1.100:8191
NODE_ENV=production
EOF

# Or export them
export JWT_SECRET=$(openssl rand -base64 32)
export FLARESOLVERR_URL="http://192.168.1.100:8191"
```

### Running with Docker Compose

```bash
# Start services (builds image on first run)
docker-compose up -d

# View logs
docker-compose logs -f sweaterr

# Check status
docker-compose ps

# Access at http://localhost:3000

# Stop services (keeps data in ./data directory)
docker-compose down

# Stop and remove volumes/data
docker-compose down -v
```

### Database Access (Docker Compose)

```bash
# Database file is in ./data/dev.db (bind mount)
ls -la data/dev.db

# Direct access with sqlite3
sqlite3 data/dev.db

# View Prisma migrations applied
docker-compose exec sweaterr npx prisma migrate status

# Backup database
cp data/dev.db data/dev.db.backup

# Restore from backup
cp data/dev.db.backup data/dev.db
docker-compose restart sweaterr
```

### Useful Docker Compose Commands

```bash
# View logs (follow mode)
docker-compose logs -f sweaterr

# Access container shell
docker-compose exec sweaterr bash

# Run one-off commands
docker-compose exec sweaterr npx prisma studio
docker-compose exec sweaterr npx prisma migrate status

# Restart service
docker-compose restart sweaterr

# Rebuild image (after code changes)
docker-compose build --no-cache

# Full cleanup
docker-compose down -v
```

### Volumes Explanation

```yaml
volumes:
  - ./data:/app/data           # Bind mount: local ./data → container /app/data
  - ./prisma:/app/prisma:ro    # Bind mount (read-only): schema only
```

- `./data` directory on your host machine contains `dev.db` file
- Changes are immediately reflected both ways
- **Persistence**: Database survives container restarts

---

## 3. Docker CLI (Manual Control)

### Prerequisites

```bash
# Build image (or use pre-built image)
docker build -t sweaterr:latest .

# Create data directory for bind mount
mkdir -p data
```

### Running with Docker

```bash
# Basic run command
docker run -p 3000:3000 \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  -e DATABASE_URL="file:/app/data/dev.db" \
  -e FLARESOLVERR_URL="http://192.168.1.100:8191" \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/prisma:/app/prisma:ro \
  --name sweaterr \
  sweaterr:latest

# Access at http://localhost:3000
```

### Container Management

```bash
# View container logs
docker logs -f sweaterr

# Access shell
docker exec -it sweaterr bash

# Stop container
docker stop sweaterr

# Remove container
docker rm sweaterr

# Run commands
docker exec sweaterr npx prisma migrate status

# View mounted volumes
docker inspect sweaterr | grep Mounts -A 10
```

### Database Access (Docker CLI)

```bash
# Direct file access (bind mount)
ls -la data/dev.db
sqlite3 data/dev.db

# Or through container
docker exec sweaterr sqlite3 /app/data/dev.db
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Authentication secret (generate with `openssl rand -base64 32`) | `abcdef123...` |
| `FLARESOLVERR_URL` | Cloudflare bypass service URL | `http://flaresolverr:8191` or `http://192.168.1.100:8191` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./prisma/dev.db` (local) or `file:/app/data/dev.db` (Docker) |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `DEEPSEEK_API_KEY` | DeepSeek API key | - |
| `PERPLEXITY_API_KEY` | Perplexity API key | - |
| `NODE_ENV` | Environment mode | `production` |

### Generating JWT_SECRET

```bash
# Generate a secure random secret
openssl rand -base64 32

# Or with Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Bind Mounts vs Volumes

### Bind Mounts (Used in docker-compose.yml)

```yaml
volumes:
  - ./data:/app/data              # Host path → Container path
  - ./prisma:/app/prisma:ro       # Read-only
```

**Pros:**
- 📁 Direct access from host machine
- 🔄 Real-time sync both ways
- 🛠️ Easy to backup/edit files
- 🔍 Can inspect with local tools (sqlite3, cat, etc.)

**Cons:**
- 🐌 Slightly slower I/O on Mac/Windows (Docker Desktop limitation)
- 📝 Requires existing directories on host

### Docker Volumes (Not used)

```yaml
volumes:
  sweaterr-db:
    driver: local
```

**Pros:**
- ⚡ Better I/O performance on Mac/Windows
- 🔒 Isolated from host filesystem
- 📦 Easier to manage multiple instances

**Cons:**
- 🔍 Hard to access directly from host
- 📁 Need Docker commands to inspect

---

## Directory Structure

After setup, your directory structure should look like:

```
sweaterr/
├── data/                        # Bind mount for database
│   ├── dev.db                   # SQLite database (created by migrations)
│   └── dev.db-journal           # SQLite journal (temporary)
├── prisma/
│   ├── schema.prisma
│   └── dev.db                   # Local dev database (for local development only)
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── ...
├── docker-compose.yml           # Docker Compose configuration
├── Dockerfile                   # Docker image definition
├── package.json
├── .env.local                   # Local environment (git ignored)
└── ...
```

---

## Common Tasks

### Switch Between Local Dev and Docker

```bash
# Stop Docker Compose
docker-compose down

# Switch to local development
npm install
export DATABASE_URL="file:./prisma/dev.db"
export JWT_SECRET=$(openssl rand -base64 32)
npm run dev

# Later, switch back to Docker
docker-compose up -d
# Database in ./data/dev.db persists!
```

### Backup and Restore Database

```bash
# Backup (works with all methods)
cp data/dev.db data/dev.db.backup
# or for local dev:
cp prisma/dev.db prisma/dev.db.backup

# Restore
cp data/dev.db.backup data/dev.db
docker-compose restart sweaterr  # if using Docker

# Backup to external location
tar -czf sweaterr-backup-$(date +%Y%m%d).tar.gz data/dev.db prisma/
```

### Debug Issues

```bash
# Check container logs
docker-compose logs -f sweaterr

# Check if port is in use
lsof -i :3000

# Test connectivity
curl http://localhost:3000/api/health

# Inspect database
sqlite3 data/dev.db ".tables"

# View Prisma migrations
docker-compose exec sweaterr npx prisma migrate status
```

### Performance Optimization

```bash
# For Mac/Windows users experiencing slow I/O with bind mounts:
# Use named volumes with delegated mounts
volumes:
  - ./data:/app/data:delegated

# Or use cached mounts (read-heavy operations)
volumes:
  - ./data:/app/data:cached
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
# From: "3000:3000"
# To:   "3001:3000"
```

### Database Locked Error

```bash
# Usually means multiple processes accessing same database
# Stop all running instances
docker-compose down
killall node

# Restart
docker-compose up -d
```

### Changes Not Reflecting

```bash
# For local development: restart dev server
# Press Ctrl+C and run: npm run dev

# For Docker: rebuild image
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Permission Denied on data/ Directory

```bash
# Fix permissions (Linux/Mac)
sudo chown -R $USER:$USER data/

# Or change ownership
chmod -R 755 data/
```

---

## Production Deployment

For production:

1. **Use strong secrets**
   ```bash
   JWT_SECRET=$(openssl rand -base64 32)
   # Store securely in environment or secrets manager
   ```

2. **Database backup strategy**
   ```bash
   # Regular backups
   0 2 * * * docker-compose exec sweaterr cp /app/data/dev.db /app/data/backup/dev.db.$(date +%Y%m%d)
   ```

3. **Use Docker Compose** with health checks (already configured)

4. **Set up reverse proxy** (nginx/Caddy) for SSL/TLS

5. **Monitor logs** with ELK or similar

6. **Update regularly**
   ```bash
   git pull
   docker-compose build --no-cache
   docker-compose up -d
   ```

---

## Comparison Matrix

| Feature | Local Dev | Docker Compose | Docker CLI |
|---------|-----------|----------------|-----------|
| Setup Time | 5 min | 10 min | 15 min |
| Hot-reload | ✅ Built-in | ❌ Can enable | ❌ Can enable |
| Database Persistence | ✅ File-based | ✅ Bind mount ./data | ✅ Bind mount |
| Direct DB Access | ✅ Direct | ✅ Via bind mount | ✅ Via bind mount |
| Production Ready | ❌ No | ✅ Yes | ✅ Yes |
| Easy Debugging | ✅ Yes | ⚠️ Via logs | ⚠️ Via logs |
| Dependency Isolation | ❌ No | ✅ Yes | ✅ Yes |
| Learning Curve | ⭐ Easy | ⭐⭐ Medium | ⭐⭐ Medium |

