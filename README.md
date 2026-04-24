# City GPT SuperApp

Unified AI agent launcher portal. One login, all your AI apps in one place.

---

# ARCHITECTURE

## What This App Does

```
┌─────────────────────────────────────────────────────────────┐
│                     CITY GPT SUPERAPP                        │
│                                                              │
│  Users login (Local / LDAP / Keycloak SSO)                   │
│       ↓                                                      │
│  See app cards filtered by their LDAP group/role             │
│       ↓                                                      │
│  Click LAUNCH (new tab) or OPEN (embedded in portal)         │
│       ↓                                                      │
│  Super admin configures everything from Settings panel       │
└─────────────────────────────────────────────────────────────┘
```

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  BROWSER                                                      │
│  http://apps.yourdomain.com                                   │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  NGINX / CADDY (reverse proxy + SSL)           [optional]     │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  DOCKER CONTAINER (port 3000)                                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  SvelteKit (Node.js 20)                                  │ │
│  │                                                          │ │
│  │  Pages:                                                  │ │
│  │    /login    → Terminal login (LOCAL/LDAP/SSO tabs)      │ │
│  │    /home     → App card grid dashboard                   │ │
│  │    /embed/*  → Iframe embed viewer                       │ │
│  │    /settings → Admin panel (6 tabs)                      │ │
│  │                                                          │ │
│  │  API:                                                    │ │
│  │    /api/auth/*    → Login, logout, OIDC, providers       │ │
│  │    /api/apps/*    → App list, launch logging             │ │
│  │    /api/admin/*   → CRUD: apps, users, categories, auth  │ │
│  │    /api/favorites → Toggle favorites                     │ │
│  └──────────────────────────┬──────────────────────────────┘ │
│                             │                                 │
│                             ▼                                 │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  SQLite Database (superapp.db)                           ││
│  │                                                          ││
│  │  10 tables:                                              ││
│  │    users, apps, categories, app_roles, favorites,        ││
│  │    app_usage, activity_log, sso_users, auth_providers,   ││
│  │    settings                                              ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  Docker Volume: city-gpt-superapp-data                        │
│  (database + backups persist across rebuilds)                 │
└──────────────────────────────────────────────────────────────┘
```

## Auth Flow

```
User opens login page
  ↓
Picks auth method: LOCAL / LDAP / SSO
  ↓
┌─ LOCAL ──→ Check super admin env vars → Check DB password_hash
│
├─ LDAP ───→ Loop through active LDAP providers (priority order)
│             → Bind attempt with username/password
│             → Extract groups, display name, email
│
└─ SSO ────→ Redirect to Keycloak instance
              → OIDC authorization code flow
              → Exchange code for token → Get user info
  ↓
On success:
  → Upsert user in DB (username, role, auth_source, groups)
  → Sign JWT token (HS256, 24h expiry)
  → Set HttpOnly cookie
  → Log activity (login action, IP, user agent)
  → Show CLI boot transition (loads all apps dynamically)
  → Redirect to /home
```

## Database Schema

```
users
  ├── id, username, display_name, email
  ├── role (super_admin / admin / user / viewer)
  ├── auth_source (local / ldap / sso)
  ├── status (active / disabled)
  ├── password_hash (local users only)
  ├── ldap_groups (JSON array)
  └── created_at, last_login

apps
  ├── id, name, slug, description, url
  ├── icon (emoji), card_color
  ├── category_id → categories
  ├── launch_mode (redirect / embed)
  ├── status (active / draft / disabled)
  └── sort_order, created_at

categories
  └── id, name, sort_order

app_roles
  └── app_id → apps, ldap_group (which groups see which apps)

favorites
  └── user_id → users, app_id → apps

app_usage
  └── user_id, app_id, action, created_at

activity_log
  ├── user_id, action (login/logout/app_launch)
  ├── detail, app_id
  └── ip_address, user_agent, created_at

auth_providers
  ├── id, name, type (ldap / keycloak / local)
  ├── config (JSON: url, bind_dn, realm, client_id, etc)
  ├── status (active / disabled)
  └── priority (order for LDAP fallback)

sso_users
  └── user_id, provider, provider_user_id, provider_email, provider_data

settings
  └── key, value (portal_title, portal_subtitle, etc)
```

## File Structure

```
City-GPT-SuperApp/
├── frontend/
│   ├── src/
│   │   ├── app.css                  ← Brutalist design system
│   │   ├── app.html                 ← HTML + Space Grotesk font
│   │   ├── hooks.server.ts          ← Auth middleware (loads user on every request)
│   │   ├── lib/
│   │   │   ├── server/
│   │   │   │   ├── db.ts            ← SQLite connection (WAL mode, Drizzle ORM)
│   │   │   │   ├── schema.ts        ← 10 table definitions
│   │   │   │   ├── auth.ts          ← JWT (auto-generated secret) + LDAP bind
│   │   │   │   ├── migrate.ts       ← Auto-migration + seed (safe, idempotent)
│   │   │   │   ├── activity.ts      ← Activity logging helper
│   │   │   │   └── backup.ts        ← Auto-backup system
│   │   │   ├── AppCard.svelte       ← App card component
│   │   │   └── IconPicker.svelte    ← Emoji icon picker (80+ icons)
│   │   └── routes/
│   │       ├── login/               ← Terminal login (3 auth tabs, boot animation)
│   │       ├── home/                ← Card grid (search, categories, favorites)
│   │       ├── embed/[slug]/        ← Iframe embed viewer
│   │       ├── settings/            ← Admin panel (6 tabs)
│   │       └── api/                 ← REST API (auth, apps, admin, favorites)
│   └── data/
│       ├── superapp.db              ← SQLite database (auto-created)
│       ├── .jwt_secret              ← Auto-generated JWT secret (persists)
│       └── backups/                 ← Auto-backups (last 10)
├── Dockerfile                       ← Node 20, builds frontend, serves on :3000
├── docker-compose.yml               ← Named volume for data persistence
├── .env.example                     ← Environment variable template
├── deploy.sh                        ← Safe deployment script
├── CLAUDE.md                        ← Full technical docs
├── DEPLOYMENT.md                    ← Deployment guide for engineers
└── README.md                        ← This file
```

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend | SvelteKit 2 + Svelte 5 | Same as City-Dash, fast, SSR |
| Styling | Tailwind CSS v4 | Utility-first, matches City-Dash |
| Database | SQLite 3 | Zero config, single file, Docker-friendly |
| ORM | Drizzle | Type-safe, lightweight |
| Auth | JWT (jose) + LDAP (ldapjs) | Industry standard |
| Deploy | Docker + Node 20 | One command deploy |

## Security

| Feature | How |
|---------|-----|
| JWT Secret | Auto-generated on first boot, persisted to `data/.jwt_secret`. Never hardcoded. |
| Passwords | Stored in SQLite (dev mode). LDAP/SSO passwords never stored. |
| Cookies | HttpOnly, SameSite=Lax |
| LDAP Secrets | Stored in DB, client_secret masked in API responses |
| Auth Guard | Server-side middleware checks JWT on every request |
| Role Check | super_admin required for all /api/admin/* endpoints |
| Activity Log | Every login, logout, app launch logged with IP + user agent |

---

# 1. FIRST TIME INSTALL

Do this only once on a fresh server.

## Prerequisites

```bash
docker --version          # Need Docker 20+
docker compose version    # Need v2+
git --version             # Need git
```

## Install

```bash
# Clone
git clone https://github.com/raahulgupta07/RLAI-citysuperapp.git City-GPT-SuperApp
cd City-GPT-SuperApp

# Create env (only SUPER_ADMIN_PASS is required — JWT is auto-generated)
cp .env.example .env
nano .env
#   SUPER_ADMIN_PASS=YourStrongPassword    ← change this

# Build and start
docker compose up -d --build

# Verify
docker compose logs --tail 5
# Should see: Listening on http://0.0.0.0:3000
```

**JWT_SECRET is auto-generated** — no need to set it manually. A random 64-character secret is created on first boot and saved to `data/.jwt_secret` inside the Docker volume. It persists across container rebuilds.

## First Login

```
URL:      http://your-server-ip:3000
Username: admin
Password: (whatever you set in SUPER_ADMIN_PASS, default: admin)
Tab:      LOCAL
```

## After First Login

| Step | What | Where |
|------|------|-------|
| 1 | Change admin password | Settings → USERS → admin → RESET PWD |
| 2 | Add auth providers | Settings → AUTH → + ADD PROVIDER (LDAP/Keycloak) |
| 3 | Add your apps | Settings → APPS → + ADD APP |
| 4 | Add categories | Settings → CATEGORIES → + ADD (optional) |

## Reverse Proxy (optional, for domain + SSL)

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

**Caddy (auto-SSL):**
```
apps.yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

# 2. UPGRADE

Do this every time there's a code update. Data is safe.

```bash
cd City-GPT-SuperApp
git pull
docker compose up -d --build
```

**Done.** All users, apps, settings, auth providers, logs preserved.

### What happens:

```
git pull                     → new code downloaded (database untouched)
docker compose up -d --build → new container built, same Docker volume mounted
  → Auto-backs up database
  → New tables added (IF NOT EXISTS)
  → New columns added (ALTER TABLE, skips if exists)
  → NO data deleted, NO tables dropped
  → App ready on :3000 with all data intact
```

### Verify:
```bash
docker compose logs --tail 5
```

### Rollback (if needed):
```bash
# Option 1: Old code
git log --oneline -5
git checkout <hash>
docker compose up -d --build

# Option 2: Restore database backup
docker exec city-gpt-superapp-superapp-1 ls /app/frontend/data/backups/
docker cp city-gpt-superapp-superapp-1:/app/frontend/data/backups/<filename> ./restore.db
docker compose down
docker cp ./restore.db city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db
docker compose up -d
```

---

# REFERENCE

## Settings Panel (6 tabs)

| Tab | What You Can Do |
|-----|----------------|
| **APPS** | Add/edit/delete/disable apps, emoji icons, categories, redirect/embed mode, LDAP group access |
| **CATEGORIES** | Create/edit/delete app categories |
| **USERS** | Create local users, change roles (super_admin/admin/user/viewer), enable/disable, reset passwords, view login count + first/last login |
| **LOGS** | Full audit trail: login, logout, app_launch with timestamp, user, IP, detail. Search + filter. |
| **ANALYTICS** | 35+ insights: key metrics, active users, trends, top/least apps, peak hours, per-user stats, system health |
| **AUTH** | Add/edit/delete LDAP servers + Keycloak instances. Test connection. Enable/disable. Priority ordering. |

## Auth Methods

| Method | How It Works |
|--------|-------------|
| **Local** | Username + password stored in SQLite. Register on login page. |
| **LDAP** | Multiple servers supported. Tried in priority order. Configured from UI. |
| **SSO** | Keycloak OIDC. Multiple instances. Configured from UI. |

## Safe Docker Commands

```bash
docker compose up -d              # Start
docker compose down               # Stop (data safe)
docker compose up -d --build      # Rebuild (data safe)
docker compose restart            # Restart
docker compose logs --tail 50     # Logs
docker compose ps                 # Status
```

## NEVER Run (deletes all data)

```bash
docker compose down -v              # ❌
docker volume rm city-gpt-superapp-data  # ❌
```

## Manual Backup

```bash
docker cp city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db ./backup-$(date +%Y%m%d).db
```

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `SUPER_ADMIN_PASS` | admin | **YES** | Admin password. Change this. |
| `SUPER_ADMIN_USER` | admin | No | Admin username |
| `JWT_SECRET` | (auto-generated) | No | Auto-created on first boot. Only set if you want to share across multiple instances. |
| `NODE_ENV` | production | No | Leave as production |

LDAP and Keycloak are configured from the UI (Settings → AUTH). No env vars needed.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can't access app | `docker compose logs --tail 20` |
| Container restarting | `docker compose logs` — check build errors |
| Login not working | Use LOCAL tab, check SUPER_ADMIN_PASS in .env |
| Forgot password | Settings → USERS → RESET PWD |
| Port in use | Change `"3000:3000"` to `"8080:3000"` in docker-compose.yml |
| LDAP not connecting | Settings → AUTH → TEST button |
| Apps not showing | Check app status is ACTIVE, check user's LDAP group matches |
| Embed not working | Target app must allow iframing (X-Frame-Options header) |

## License

Internal use only.
