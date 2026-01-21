#!/bin/bash

# Security check script for Sweaterr
# Verifies that no hardcoded secrets are present before publishing to Docker registry

set -e

echo "🔍 Scanning for hardcoded secrets and credentials..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

# Patterns to search for
PATTERNS=(
    "your-secret"
    "change-in-production"
    "test-password"
    "dummy-api-key"
    "sk_test_"
    "sk_live_"
    "AKIA"
)

# Files to check
declare -a FILES_TO_CHECK=(
    "Dockerfile"
    "docker-compose.yml"
    "next.config.ts"
    ".env.local"
    ".env.production"
)

# Directories to scan recursively
declare -a DIRS_TO_SCAN=(
    "src/lib"
    "src/app/api"
    "src/components"
)

echo ""
echo "📋 Checking critical files..."
for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        for pattern in "${PATTERNS[@]}"; do
            if grep -qi "$pattern" "$file"; then
                echo -e "${RED}❌ Found potential secret in: $file${NC}"
                grep -n -i "$pattern" "$file" || true
                ERRORS=$((ERRORS + 1))
            fi
        done
    fi
done

echo ""
echo "📂 Scanning source directories..."
for dir in "${DIRS_TO_SCAN[@]}"; do
    if [ -d "$dir" ]; then
        for pattern in "${PATTERNS[@]}"; do
            matches=$(grep -r -i "$pattern" "$dir" --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null || true)
            if [ ! -z "$matches" ]; then
                echo "$matches"
                echo -e "${YELLOW}⚠️  Review the above matches in: $dir${NC}"
                ERRORS=$((ERRORS + 1))
            fi
        done
    fi
done

# Check for environment variables that need to be set
echo ""
echo "✅ Checking required environment variables..."
REQUIRED_VARS=(
    "DATABASE_URL"
    "JWT_SECRET"
    "FLARESOLVERR_URL"
)

for var in "${REQUIRED_VARS[@]}"; do
    if grep -r "process\.env\.$var" src/ --include="*.ts" --include="*.tsx" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $var is properly configured${NC}"
    fi
done

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Security check passed! No hardcoded secrets detected.${NC}"
    exit 0
else
    echo -e "${RED}❌ Security check failed! Found $ERRORS potential issues.${NC}"
    exit 1
fi
