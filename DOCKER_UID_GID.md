# Docker UID/GID Mapping Guide

## Problem

When running Sweaterr in Docker with bind-mounted volumes (like `/app/data`), permission issues can arise:
- Files created by the root user (UID 0) inside the container cannot be modified by non-root users on the host
- SQLite database files become inaccessible, causing Prisma socket timeouts
- Log files and configuration files have incorrect ownership

## Solution

The Dockerfile now supports custom UID/GID mapping via build arguments. This ensures that files created inside the container match your local user's permissions.

## How to Use

### Option 1: Local Development (docker-compose)

1. **Get your UID and GID:**
   ```bash
   id
   # Output example: uid=1000(malevolent) gid=1000(malevolent) groups=1000(malevolent)
   ```

2. **Set environment variables before running docker-compose:**
   ```bash
   export UID=1000
   export GID=1000
   docker-compose up -d --build
   ```

3. **Or set them directly in the command:**
   ```bash
   UID=1000 GID=1000 docker-compose up -d --build
   ```

### Option 2: Manual Docker Build

```bash
docker build \
  --build-arg UID=1000 \
  --build-arg GID=1000 \
  -t sweaterr:latest \
  .
```

### Option 3: Production (GHCR without custom UID)

If pulling from GHCR (`ghcr.io/adocampo/sweaterr:latest`), the image uses default UID/GID (1000:1000).
To adjust permissions for your specific user:

1. **Run once with root to fix permissions:**
   ```bash
   docker run --rm -v sweaterr-data:/app/data alpine chown -R 1000:1000 /app/data
   ```

2. **Then start the application:**
   ```bash
   docker-compose up -d
   ```

## Key Changes

- **Non-root user**: The container now runs as user `sweaterr` (not root)
- **Named volumes**: Data is stored in Docker-managed named volumes (`sweaterr-data`)
- **Prisma schema**: Baked into the image (no longer mounted from host)
- **Permissions**: All files created inside `/app/data` have correct UID/GID

## Troubleshooting

### SQLite "Socket timeout" errors

**Cause**: SQLite database file is owned by root and cannot be written by the sweaterr user.

**Fix**:
```bash
# Stop the container
docker-compose down

# Fix permissions
docker run --rm -v sweaterr-data:/app/data alpine chown -R 1000:1000 /app/data

# Restart
docker-compose up -d
```

### "Could not find Prisma Schema" error

**Cause**: This was a previous issue with GHCR images. It's now fixed since the schema is baked into the image.

**Fix**: Rebuild and repull the image:
```bash
docker-compose down
docker rmi ghcr.io/adocampo/sweaterr:latest
docker-compose up -d --build
```

### Permission denied on data files

**Cause**: UID/GID mismatch between host and container.

**Fix**: Rebuild with correct UID/GID:
```bash
UID=$(id -u) GID=$(id -g) docker-compose up -d --build
```

## Default Values

If you don't specify UID/GID, the image defaults to:
- **UID**: 1000
- **GID**: 1000

This works for most Linux systems where the first non-root user is 1000.
