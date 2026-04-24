# City GPT SuperApp — Deployment Guide

## CRITICAL: Data Safety Rules

### NEVER DO THESE:
```bash
# NEVER — deletes all data
docker compose down -v

# NEVER — deletes the database
rm frontend/data/superapp.db

# NEVER — deletes the Docker volume
docker volume rm city-gpt-superapp-data

# NEVER — use DROP TABLE in migrations
# NEVER — use DELETE FROM in migrations
# NEVER — use TRUNCATE in migrations
```

### ALWAYS DO THESE:
```bash
# Safe stop (preserves data)
docker compose down

# Safe restart
docker compose up -d

# Safe rebuild after code changes
./deploy.sh

# Manual backup before risky changes
curl -X POST http://localhost:3000/api/admin/backups \
  -H 'Cookie: superapp_token=YOUR_TOKEN'
```

## First-Time Installation

```bash
# 1. Clone the repo
git clone <repo-url> && cd City-GPT-SuperApp

# 2. Set environment variables
cp .env.example .env
# Edit .env:
#   JWT_SECRET=<generate-random-64-char-string>
#   SUPER_ADMIN_PASS=<strong-password>

# 3. Deploy
chmod +x deploy.sh
./deploy.sh

# 4. Login at http://localhost:3000
#    Username: admin
#    Password: (whatever you set in SUPER_ADMIN_PASS)

# 5. Configure auth providers: Settings > AUTH
# 6. Add your apps: Settings > APPS > + ADD APP
```

## Updating (Code Changes)

```bash
# Pull latest code
git pull

# Safe deploy (auto-backs up DB first)
./deploy.sh
```

The deploy script:
1. Backs up the SQLite database before building
2. Builds the frontend
3. Rebuilds the Docker container
4. Preserves the Docker volume (all data safe)
5. Runs a health check

## How Data is Protected

### 1. Docker Volume
The SQLite database lives in a Docker named volume (`city-gpt-superapp-data`). This volume persists across container rebuilds. Only `docker compose down -v` or `docker volume rm` can delete it.

### 2. Auto-Backup
Every time the app starts and runs migrations, it auto-backs up the database to `data/backups/`. Backups are also created:
- Before every migration (`pre-migrate`)
- Before every restore (`pre-restore`)
- Via manual API call or deploy script (`manual`/`deploy`)

Last 10 backups are kept automatically.

### 3. Safe Migrations
All schema changes use:
- `CREATE TABLE IF NOT EXISTS` — never overwrites existing tables
- `ALTER TABLE ... ADD COLUMN` wrapped in try/catch — skips if column exists
- Seed data only runs `IF count == 0` — never overwrites existing data
- **No DROP, DELETE, or TRUNCATE** — ever

### 4. Backup API
Super admins can backup/restore from the API:
```bash
# Create backup
POST /api/admin/backups

# List backups
GET /api/admin/backups

# Restore backup
POST /api/admin/backups {"action": "restore", "filename": "superapp_2026-04-23T21-00-00_manual.db"}
```

## Backup & Restore

### Manual Backup
```bash
# Option 1: Via API (requires auth)
curl -X POST http://localhost:3000/api/admin/backups

# Option 2: Direct file copy
cp frontend/data/superapp.db frontend/data/backups/manual_$(date +%Y%m%d).db

# Option 3: From Docker volume
docker cp city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db ./backup.db
```

### Restore
```bash
# Option 1: Via API
curl -X POST http://localhost:3000/api/admin/backups \
  -d '{"action":"restore","filename":"superapp_2026-04-23_manual.db"}'

# Option 2: Direct file copy (stop container first)
docker compose down
docker cp ./backup.db city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db
docker compose up -d
```

## Reverse Proxy (Nginx/Caddy)

### Nginx
```nginx
server {
    listen 80;
    server_name apps.citygpt.xyz;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy
```
apps.citygpt.xyz {
    reverse_proxy localhost:3000
}
```

## Troubleshooting

### Container won't start
```bash
docker compose logs
```

### Lost data
Check backups:
```bash
ls frontend/data/backups/
# Or from Docker:
docker exec city-gpt-superapp-superapp-1 ls /app/frontend/data/backups/
```

### Reset to fresh (DESTROYS ALL DATA)
Only if you intentionally want to start over:
```bash
docker compose down
docker volume rm city-gpt-superapp-data
rm -f frontend/data/superapp.db
docker compose up -d --build
```
