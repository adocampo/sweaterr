# Docker Deployment Guide - Sweaterr

## 🔐 Security Configuration

Before deploying Sweaterr using Docker, ensure you have generated secure values for all required environment variables.

### Required Environment Variables

```bash
# Generate secure secrets (recommended for production)
openssl rand -base64 32  # JWT_SECRET (optional if you use the auto-generated volume secret)

# Set these in your docker-compose.yml or deployment configuration:

# Database Configuration
DATABASE_URL="file:/app/data/app.db"  # or PostgreSQL URL for production

# Authentication Secrets
# - Optional: If NOT set, Docker autogenera y persiste en /app/data/.jwt_secret
# - Recomendado en producción para instalaciones reproducibles
JWT_SECRET="<your-secure-random-string>"  # opcional (si omites, se genera y persiste en /app/data/.jwt_secret)

# FlareSolverr URL (must be accessible from the container)
FLARESOLVERR_URL="http://flaresolverr:8191"
```

### Optional Environment Variables

```bash
# FlareSolverr Session Management
FLARESOLVERR_SESSION_TTL=3600

# AI Provider Configuration
AI_PROVIDER="openai"  # or "deepseek", "perplexity", "ollama"
AI_API_KEY="<your-api-key>"
AI_BASE_URL="<optional-custom-endpoint>"

# Google CSE (if using Google search integration)
NEXT_PUBLIC_CSE_ID="<your-cse-id>"
NEXT_PUBLIC_CSE_API_KEY="<your-api-key>"

# JDownloader Configuration
JDOWNLOADER_HOST="localhost"
JDOWNLOADER_PORT=3129
```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

The `docker-compose.yml` file is pre-configured with sensible defaults.

1. **Optionally set environment variables** in `docker-compose.yml`:

```yaml
environment:
  # Optional: omit to auto-generate and persist in /app/data/.jwt_secret
  - # JWT_SECRET=<your-generated-secret>  # opcional: si se omite, se genera y persiste en /app/data/.jwt_secret
  - DATABASE_URL=file:/app/data/app.db
  - FLARESOLVERR_URL=http://flaresolverr:8191
```

1. **Start the services**:

```bash
docker-compose up -d
```

1. **Access the application**:
   - Frontend: `http://localhost:3000`
   - Setup: `http://localhost:3000/setup` (first-time initialization)

### Standalone Docker

Build and run a single container:

```bash
# Build the image
docker build -t sweaterr:latest .

# Run the container
docker run -d \
  --name sweaterr \
  -p 3000:3000 \
  -v sweaterr-data:/app/data \
  -e DATABASE_URL="file:/app/data/app.db" \
  # Optional: omit to auto-generate and persist in /app/data/.jwt_secret
  # -e JWT_SECRET="<your-secret>" \
  -e FLARESOLVERR_URL="http://host.docker.internal:8191" \
  # Optional timezone (more human than binding /etc/localtime)
  -e TZ="Europe/Madrid" \
  sweaterr:latest
```

### Publishing to Docker Registry

To push your image to Docker Hub or another registry:

```bash
# Tag the image
docker tag sweaterr:latest your-username/sweaterr:latest

# Login to registry
docker login

# Push the image
docker push your-username/sweaterr:latest
```

## 🔒 Security Checklist

- ✅ Remove all hardcoded secrets from the codebase
- ✅ Secrets are only configured at runtime via environment variables (o autogeneradas en volumen)
- ✅ Database credentials are isolated in DATABASE_URL
- ✅ JWT and NEXTAUTH secrets are randomly generated (not default values)
- ✅ No sensitive data in Docker image layers
- ✅ `.env.local` is in `.gitignore` (never committed)

## 📋 Volumes

The default Docker setup creates a persistent volume for data:

```yaml
volumes:
  sweaterr-data:  # Stores SQLite database and application data
    driver: local
```

To use a specific host path instead:

```yaml
volumes:
  - /path/to/sweaterr/data:/app/data
```

## 🏥 Health Check

The Docker setup includes a health check endpoint:

```bash
curl http://localhost:3000/api/health
```

## 🔄 Integration with Sonarr/Radarr

Sweaterr provides Torznab/Newznab API compatibility. Configure it in your *arr application:

1. Add indexer in Sonarr/Radarr/Lidarr
2. Set URL: `http://sweaterr:3000/api/v1/torznab`
3. API Key: Configure in Sweaterr's forum settings

For detailed setup instructions, see `docs/ARR_SETUP.md`.
