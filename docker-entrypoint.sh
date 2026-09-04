#!/bin/sh
set -e

# Set timezone if provided
if [ -n "$TZ" ] && [ -f "/usr/share/zoneinfo/$TZ" ]; then
  export TZ
fi

# Fix data directory permissions to match container user
if [ -d "/app/data" ]; then
  chown -R ${UID}:${GID} /app/data 2>/dev/null || true
  chmod -R 755 /app/data 2>/dev/null || true
fi

echo "Applying database migrations..."
npx prisma migrate deploy || {
  echo "Migration deploy failed, falling back to db push..."
  npx prisma db push --accept-data-loss || {
    echo "ERROR: Failed to apply database schema"
    exit 1
  }
}

# Create logs directory if it doesn't exist
mkdir -p /app/logs

# Start application with stdout/stderr redirected to log file
echo "Starting application..."
exec node /app/server.js >> /app/logs/server.log 2>&1
