#!/bin/bash

# Docker build and publish script for Sweaterr
# Usage: ./scripts/docker-build.sh [version] [registry-url]

set -e

# Configuration
DEFAULT_VERSION="latest"
DEFAULT_REGISTRY="docker.io"
USERNAME="${DOCKER_USERNAME:-your-username}"

VERSION="${1:-$DEFAULT_VERSION}"
REGISTRY="${2:-$DEFAULT_REGISTRY}"
IMAGE_NAME="sweaterr"
FULL_IMAGE_NAME="$REGISTRY/$USERNAME/$IMAGE_NAME:$VERSION"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🐳 Sweaterr Docker Build Script${NC}"
echo ""
echo "Configuration:"
echo "  Registry: $REGISTRY"
echo "  Username: $USERNAME"
echo "  Image Name: $IMAGE_NAME"
echo "  Version: $VERSION"
echo "  Full Image: $FULL_IMAGE_NAME"
echo ""

# Step 1: Run security check
echo -e "${BLUE}Step 1: Running security check...${NC}"
if [ -f "scripts/security-check.sh" ]; then
    bash scripts/security-check.sh || {
        echo -e "${RED}❌ Security check failed! Aborting build.${NC}"
        exit 1
    }
else
    echo -e "${RED}⚠️  Security check script not found, skipping...${NC}"
fi

echo ""

# Step 2: Build Docker image
echo -e "${BLUE}Step 2: Building Docker image...${NC}"
docker build -t "$FULL_IMAGE_NAME" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo ""

# Step 3: Tag as 'latest' if not already
if [ "$VERSION" != "latest" ]; then
    echo -e "${BLUE}Step 3: Tagging as latest...${NC}"
    docker tag "$FULL_IMAGE_NAME" "$REGISTRY/$USERNAME/$IMAGE_NAME:latest"
    echo -e "${GREEN}✅ Tagged as latest${NC}"
fi

echo ""

# Step 4: Run basic tests
echo -e "${BLUE}Step 4: Running basic container test...${NC}"
CONTAINER_ID=$(docker run -d \
  -e DATABASE_URL="file:/app/data/app.db" \
  -e JWT_SECRET="test-secret" \
  -e FLARESOLVERR_URL="http://localhost:8191" \
  "$FULL_IMAGE_NAME")

sleep 5

# Check if container is running
if docker ps | grep -q "$CONTAINER_ID"; then
    echo -e "${GREEN}✅ Container started successfully${NC}"
    docker stop "$CONTAINER_ID"
    docker rm "$CONTAINER_ID"
else
    echo -e "${RED}❌ Container failed to start${NC}"
    docker rm "$CONTAINER_ID" || true
    exit 1
fi

echo ""

# Step 5: Push to registry (optional)
read -p "Do you want to push the image to $REGISTRY? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Step 5: Pushing to registry...${NC}"
    
    # Check if user is logged in
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker daemon not running or not authenticated${NC}"
        echo "Please run: docker login $REGISTRY"
        exit 1
    fi
    
    docker push "$FULL_IMAGE_NAME"
    
    if [ "$VERSION" != "latest" ]; then
        docker push "$REGISTRY/$USERNAME/$IMAGE_NAME:latest"
    fi
    
    echo -e "${GREEN}✅ Push successful!${NC}"
    echo ""
    echo "Image available at:"
    echo "  $FULL_IMAGE_NAME"
    if [ "$VERSION" != "latest" ]; then
        echo "  $REGISTRY/$USERNAME/$IMAGE_NAME:latest"
    fi
else
    echo -e "${BLUE}Skipping push. To push later, run:${NC}"
    echo "  docker push $FULL_IMAGE_NAME"
    if [ "$VERSION" != "latest" ]; then
        echo "  docker push $REGISTRY/$USERNAME/$IMAGE_NAME:latest"
    fi
fi

echo ""
echo -e "${GREEN}✅ Done!${NC}"
