#!/bin/bash
set -e

echo "================================================"
echo "  City GPT SuperApp — Safe Deployment"
echo "================================================"
echo ""

# 1. Check if DB exists and backup
DB_FILE="frontend/data/superapp.db"
if [ -f "$DB_FILE" ]; then
    echo "[1/5] Backing up database..."
    BACKUP_DIR="frontend/data/backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    cp "$DB_FILE" "$BACKUP_DIR/superapp_${TIMESTAMP}_deploy.db"
    echo "  ✓ Backup saved: superapp_${TIMESTAMP}_deploy.db"
else
    echo "[1/5] No existing database found (fresh install)"
fi

# 2. Build frontend
echo "[2/5] Building frontend..."
npm run build --prefix frontend
echo "  ✓ Build complete"

# 3. Check Docker volume
echo "[3/5] Checking Docker volume..."
if docker volume inspect city-gpt-superapp-data > /dev/null 2>&1; then
    echo "  ✓ Volume exists (data will be preserved)"
else
    echo "  ⚠ Volume will be created (fresh install)"
fi

# 4. Deploy (never use -v flag!)
echo "[4/5] Deploying container..."
docker compose up -d --build
echo "  ✓ Container deployed"

# 5. Health check
echo "[5/5] Health check..."
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ App is running on http://localhost:3000"
else
    echo "  ✗ App may not be ready yet (HTTP $HTTP_CODE). Check: docker compose logs"
fi

echo ""
echo "================================================"
echo "  Deployment complete!"
echo "  IMPORTANT: NEVER run 'docker compose down -v'"
echo "  The -v flag DELETES ALL DATA."
echo "================================================"
