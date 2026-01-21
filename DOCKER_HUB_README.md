# Sweaterr - Docker Image

Sweaterr is a Next.js web application that automates direct downloads from forums by integrating with JDownloader and various AI services.

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- FlareSolverr running (for Cloudflare bypass)
- JDownloader 2 (optional, for download management)

### Generate Secrets

Before starting, generate a secure value for authentication:

```bash
# Generate JWT_SECRET
openssl rand -base64 32
```

### Using Docker Compose

1. Create a `docker-compose.yml` with your secrets:

```yaml
version: '3.8'

services:
  sweaterr:
    image: your-username/sweaterr:latest
    container_name: sweaterr
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/app.db
      - JWT_SECRET=<your-generated-jwt-secret>
      - FLARESOLVERR_URL=http://flaresolverr:8191
    volumes:
      - sweaterr-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  flaresolverr:
    image: flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    ports:
      - "8191:8191"
    environment:
      - LOG_LEVEL=info
    restart: unless-stopped

volumes:
  sweaterr-data:
    driver: local
```

1. Start the services:

```bash
docker-compose up -d
```

1. Access the application:
   - **Frontend**: `http://localhost:3000`
   - **First Setup**: `http://localhost:3000/setup`

### Using Docker CLI

```bash
docker run -d \
  --name sweaterr \
  -p 3000:3000 \
  -v sweaterr-data:/app/data \
  -e DATABASE_URL="file:/app/data/app.db" \
  -e JWT_SECRET="<your-jwt-secret>" \
  -e FLARESOLVERR_URL="http://host.docker.internal:8191" \
  your-username/sweaterr:latest
```

## Environment Variables

### Required

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | Database connection string | `file:/app/data/app.db` |
| `JWT_SECRET` | Secret for JWT token signing (generate with `openssl rand -base64 32`) | Generated string |
| `FLARESOLVERR_URL` | URL to FlareSolverr service | `http://flaresolverr:8191` |

### Optional

| Variable | Description | Default |
| --- | --- | --- |
| `FLARESOLVERR_SESSION_TTL` | FlareSolverr session time-to-live in seconds | `3600` |
| `AI_PROVIDER` | AI service provider | `openai` |
| `AI_API_KEY` | API key for AI provider | - |
| `JDOWNLOADER_HOST` | JDownloader host | `localhost` |
| `JDOWNLOADER_PORT` | JDownloader port | `3129` |

## Features

- 🚀 **Automated Forum Scraping**: Download directly from forums with ease
- 🔄 **Cloudflare Bypass**: Seamless integration with FlareSolverr
- 🤖 **AI Integration**: Extract metadata with OpenAI, DeepSeek, Perplexity, or Ollama
- 📥 **JDownloader Integration**: Automate download management
- 🔍 **Torznab/Newznab Indexer**: Compatible with Sonarr, Radarr, Lidarr
- 🌍 **Internationalization**: English and Spanish support
- 🔐 **JWT Authentication**: Secure user management

## Integration with *arr Applications

Sweaterr provides a Torznab API endpoint compatible with Sonarr, Radarr, and Lidarr:

- **Torznab URL**: `http://sweaterr:3000/api/v1/torznab`
- **Newznab Compatibility**: Full support for search, category, and attribute parameters

Refer to the project documentation for detailed setup instructions.

## Health Check

The container includes a health check endpoint. You can verify it's running:

```bash
curl http://localhost:3000/api/health
```

## Volumes

- `/app/data`: Persistent storage for SQLite database and application data

## Support & Documentation

- **Project Repository**: [GitHub](https://github.com/your-username/sweaterr)
- **Issues**: Report bugs and request features
- **Documentation**: See the project's documentation files for detailed setup and configuration

## Security

- All secrets must be provided at runtime via environment variables
- The Docker image does not contain any hardcoded credentials
- Never commit `.env.local` files to version control
- Always generate new JWT and NEXTAUTH secrets for each deployment

## License

See LICENSE file in the repository for details.
