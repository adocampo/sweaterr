#!/bin/bash
set -e

echo "[*] Stopping existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

echo "[*] Building Next.js app..."
export NODE_OPTIONS="--max-old-space-size=3072"
npm run build

echo "[*] Starting Docker container..."
docker compose up -d --force-recreate sweaterr

echo "[*] Waiting for container to be ready (30 seconds)..."
sleep 30

echo "[*] Checking container status..."
docker compose ps

echo "[*] Done! Container should be running at http://localhost:3000"
