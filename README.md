# City GPT SuperApp

Unified AI agent launcher portal. One login, all your AI apps in one place.

---

# 1. FIRST TIME INSTALL

Do this only once on a fresh server.

## Prerequisites

```bash
# Check these are installed
docker --version          # Need Docker 20+
docker compose version    # Need v2+
git --version             # Need git
```

## Install Steps

```bash
# Step 1: Clone
git clone https://github.com/raahulgupta07/RLAI-citysuperapp.git City-GPT-SuperApp
cd City-GPT-SuperApp

# Step 2: Create env file
cp .env.example .env

# Step 3: Edit .env — CHANGE THESE TWO VALUES
#   JWT_SECRET=<run: openssl rand -hex 32>
#   SUPER_ADMIN_PASS=YourStrongPassword
nano .env

# Step 4: Build and start
docker compose up -d --build

# Step 5: Check it's running
docker compose logs --tail 5
# Should see: Listening on http://0.0.0.0:3000
```

## First Login

```
Open:     http://your-server-ip:3000
Username: admin
Password: (whatever you set in SUPER_ADMIN_PASS)
Tab:      LOCAL
```

## After First Login — Configure These

```
1. Settings → USERS   → admin → RESET PWD (change default password)
2. Settings → AUTH    → + ADD PROVIDER (add your LDAP/Keycloak servers)
3. Settings → APPS   → + ADD APP (add your AI agents one by one)
4. Settings → CATEGORIES → + ADD (optional: add custom categories)
```

## Optional: Reverse Proxy

**Nginx:**
```nginx
server {
    listen 80;
    server_name apps.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Caddy:**
```
apps.yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

# 2. UPGRADE (When New Code is Available)

Do this every time there's a code update. Your data is safe — it lives in a Docker volume, not inside the container.

## Upgrade Steps

```bash
# Step 1: Go to project folder
cd City-GPT-SuperApp

# Step 2: Pull new code
git pull

# Step 3: Rebuild and restart
docker compose up -d --build

# Step 4: Verify
docker compose logs --tail 5
# Should see: Listening on http://0.0.0.0:3000
```

**That's it. Your users, apps, settings, auth providers, logs — all preserved.**

## What Happens During Upgrade

```
git pull                         → downloads new code (does NOT touch database)
docker compose up -d --build     → builds new container, keeps Docker volume
  → App starts:
    → Auto-backs up database to data/backups/
    → Adds new tables (CREATE TABLE IF NOT EXISTS — safe)
    → Adds new columns (ALTER TABLE — safe, skips if exists)
    → Seed data runs only if tables are empty
    → NO data deleted, NO tables dropped, NO rows modified
  → App is ready on port 3000 with all your data intact
```

---

# QUICK REFERENCE

## Safe Commands
```bash
docker compose up -d              # Start
docker compose down               # Stop (data stays)
docker compose up -d --build      # Rebuild (data stays)
docker compose restart            # Restart
docker compose logs --tail 50     # View logs
docker compose ps                 # Check status
```

## NEVER Run These (deletes all data)
```bash
docker compose down -v              # ❌ -v flag deletes volumes
docker volume rm city-gpt-superapp-data  # ❌ deletes database
```

## Manual Backup
```bash
docker cp city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db ./backup-$(date +%Y%m%d).db
```

## Rollback
```bash
# Go back to old code
git log --oneline -5              # find commit hash
git checkout <hash>
docker compose up -d --build

# Or restore database backup
docker compose down
docker cp ./backup-20260424.db city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db
docker compose up -d
```

## Change Port
Edit `docker-compose.yml` → change `"3000:3000"` to `"8080:3000"` → `docker compose up -d --build`

## Troubleshooting
```bash
docker compose logs --tail 20     # Check errors
docker compose logs -f            # Follow live
docker compose ps                 # Is it running?
```

---

# FEATURES

- **Multi-Auth** — Local + LDAP + Keycloak SSO, all configurable from UI
- **App Cards** — Emoji icons, categories, embed/redirect modes
- **Role-Based Access** — LDAP group filtering, 4 user roles
- **Embed Mode** — Run apps inside the portal via iframe
- **Activity Logging** — Login, logout, app launch with IP + user agent
- **35+ Analytics** — Usage trends, top apps, peak hours, per-user stats
- **Auth Providers** — Multiple LDAP servers + Keycloak instances from UI
- **Auto-Backup** — Database backed up before every migration
- **Brutalist UI** — City-Dash design system

## Settings Panel

| Tab | What You Can Do |
|-----|----------------|
| **APPS** | Add/edit/delete/disable apps |
| **CATEGORIES** | Manage app categories |
| **USERS** | Roles, enable/disable, reset passwords, login stats |
| **LOGS** | Audit trail of all user activity |
| **ANALYTICS** | 35+ insights with ASCII bar charts |
| **AUTH** | Configure LDAP and Keycloak providers |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | SvelteKit 2 + Svelte 5 + Tailwind v4 |
| Database | SQLite 3 (better-sqlite3 + Drizzle ORM) |
| Auth | JWT + LDAP + Keycloak OIDC |
| Deploy | Docker + Node.js 20 |
| Port | 3000 |

## Environment Variables

| Variable | Default | Must Change? |
|----------|---------|-------------|
| `JWT_SECRET` | superapp-dev-secret | **YES** |
| `SUPER_ADMIN_PASS` | admin | **YES** |
| `SUPER_ADMIN_USER` | admin | No |

## License

Internal use only.
