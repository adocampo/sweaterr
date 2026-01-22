#!/bin/bash
# Development setup script for Docker development

set -e

echo "🐳 Sweaterr Development Setup"
echo ""

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install Docker Desktop or docker-compose."
    exit 1
fi

# Create data directory for database
mkdir -p data

# Ask for required environment variables
read -p "Enter JWT_SECRET (or press Enter for testing): " JWT_SECRET
JWT_SECRET=${JWT_SECRET:-"test-secret-do-not-use-in-production"}

read -p "Enter FLARESOLVERR_URL (default: http://flaresolverr:8191): " FLARESOLVERR_URL
FLARESOLVERR_URL=${FLARESOLVERR_URL:-"http://flaresolverr:8191"}

# Export environment variables
export JWT_SECRET
export FLARESOLVERR_URL

echo ""
echo "Starting Sweaterr with Docker Compose..."
echo "DATABASE_URL will be set to: file:/app/data/dev.db"
echo ""

# Start services
docker-compose up -d

# Wait for service to be ready
echo "Waiting for Sweaterr to be ready..."
sleep 5

# Check health
if docker-compose exec sweaterr wget --no-verbose --tries=1 --spider http://localhost:3000/api/health 2>/dev/null; then
    echo ""
    echo "✅ Sweaterr is ready!"
    echo "🌐 Access at: http://localhost:3000"
    echo ""
    echo "📝 Next steps:"
    echo "1. Create admin user at: http://localhost:3000/setup"
    echo "2. Login and configure forums/services"
    echo "3. For logs: docker-compose logs -f sweaterr"
    echo "4. To stop: docker-compose down"
else
    echo "⚠️  Service may still be starting. Check logs with:"
    echo "   docker-compose logs -f sweaterr"
fi
