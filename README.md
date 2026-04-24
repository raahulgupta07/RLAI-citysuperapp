# City GPT SuperApp

Unified AI agent launcher portal. One login, all your AI apps in one place.

---

## Features

- **Multi-auth login** -- Local accounts, LDAP (Active Directory), and SSO (Keycloak, Google, Microsoft) all from one login page
- **Auth method toggles** -- Enable or disable LOCAL, LDAP, and SSO independently from the admin panel (Settings > AUTH)
- **Per-provider SSO buttons** -- Each configured SSO provider gets its own branded login button with icon
- **Remember me** -- Optional 30-day sessions (checkbox on login)
- **App launcher dashboard** -- Card grid with search, categories, favorites, and LDAP group-based filtering
- **Embed mode** -- Open apps inside the portal via iframe, or launch in a new tab
- **Admin panel** -- 6-tab settings panel: Apps, Categories, Users, Logs, Analytics, Auth
- **Activity audit trail** -- Every login, logout, app launch, and admin action logged with IP and user agent
- **Health check** -- `GET /api/health` returns uptime, DB status, and user count
- **Auto-backup** -- Database backed up automatically; last 10 kept
- **Docker-ready** -- Single container, named volume for persistence, built-in healthcheck

---

## Security

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt (10 rounds). Legacy plain-text passwords auto-migrated on login. |
| Password policy | Min 8 characters, at least 1 uppercase, 1 lowercase, 1 number |
| Rate limiting | 5 attempts per username + 20 per IP in a 15-minute sliding window |
| OIDC protection | CSRF state parameter + PKCE (S256 code challenge) on all SSO flows |
| Security headers | CSP, X-Frame-Options (SAMEORIGIN), X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS (production) |
| Session invalidation | Token blacklisted on logout; expired entries cleaned automatically |
| CORS protection | Cross-origin mutating API requests (POST/PUT/DELETE) rejected by server hook |
| Input sanitization | HTML/script injection stripped from all text inputs; URLs restricted to http/https |
| Cookies | HttpOnly, SameSite=Lax, Secure in production |
| JWT secret | Auto-generated 64-char random secret, persisted to `data/.jwt_secret`. Never hardcoded. |
| Auth guard | Server-side middleware verifies JWT on every request |
| Disabled user enforcement | Disabled users blocked at login and on every authenticated request (checked against DB) |
| Audit logging | All admin actions (auth toggles, user changes, provider edits) logged to `activity_log` |
| Role enforcement | `super_admin` required for all `/api/admin/*` endpoints |
| LDAP secrets | `client_secret` and `app_dn_password` masked in API responses |

---

## First-Time Setup

### Prerequisites

```bash
docker --version          # Need Docker 20+
docker compose version    # Need v2+
```

### Install

```bash
git clone https://github.com/raahulgupta07/RLAI-citysuperapp.git City-GPT-SuperApp
cd City-GPT-SuperApp

# Create env (only SUPER_ADMIN_PASS is required)
cp .env.example .env
nano .env
#   SUPER_ADMIN_PASS=YourStrongPassword

# Build and start
docker compose up -d --build

# Verify
docker compose logs --tail 5
# Should see: Listening on http://0.0.0.0:3000
```

### First Login

```
URL:      http://your-server-ip:3000
Username: admin
Password: (whatever you set in SUPER_ADMIN_PASS, default: admin)
Tab:      LOCAL
```

### After First Login

| Step | Action | Where |
|------|--------|-------|
| 1 | **Change default admin password** | Settings > USERS > admin > RESET PWD |
| 2 | Configure LDAP providers (optional) | Settings > AUTH > + ADD PROVIDER |
| 3 | Configure SSO providers (optional) | Settings > AUTH > + ADD PROVIDER (Keycloak/Google/Microsoft) |
| 4 | **Enable LDAP and/or SSO** | Settings > AUTH > toggle switches |
| 5 | Add your apps | Settings > APPS > + ADD APP |
| 6 | Add categories (optional) | Settings > CATEGORIES > + ADD |

**Defaults:** Only LOCAL auth is enabled. LDAP and SSO must be enabled from Settings > AUTH after you configure at least one provider. A security warning is shown if the default admin password has not been changed.

---

## Architecture

```
Browser  -->  Nginx/Caddy (optional, SSL)  -->  Docker Container (port 3000)
                                                  |
                                                  SvelteKit (Node.js 20)
                                                  |
                                                  SQLite (superapp.db, WAL mode)
                                                  |
                                                  Docker Volume (city-gpt-superapp-data)
```

### Auth Flow

```
User picks auth method: LOCAL / LDAP / SSO
  |
  +-- LOCAL --> bcrypt password check against DB
  |
  +-- LDAP --> Loop active providers (priority order)
  |             -> Bind with Application DN (service account) or direct user bind
  |             -> Search for user, extract groups/email/display name
  |             -> Re-bind as user to verify password (if service account was used)
  |
  +-- SSO ----> Redirect to provider (Keycloak/Google/Microsoft)
                -> OIDC authorization code flow with PKCE + CSRF state
                -> Exchange code for token -> Get user info
  |
  On success:
    -> Upsert user in DB (username, role, auth_source, groups)
    -> Sign JWT (HS256, 24h or 30d with Remember Me)
    -> Set HttpOnly cookie
    -> Log activity (login action, IP, user agent)
    -> Redirect to /home
```

### Database (SQLite -- 10 tables)

`users`, `apps`, `categories`, `app_roles`, `favorites`, `app_usage`, `activity_log`, `sso_users`, `auth_providers`, `settings`

Auto-migrated on startup. New columns added via ALTER TABLE (safe, idempotent).

---

## Configuration

### Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `SUPER_ADMIN_PASS` | admin | **YES** | Admin password. Change this. |
| `SUPER_ADMIN_USER` | admin | No | Admin username |
| `JWT_SECRET` | (auto-generated) | No | Auto-created on first boot. Only set to share across multiple instances. |
| `NODE_ENV` | production | No | Leave as production |

### LDAP Configuration (via UI)

LDAP is configured entirely from the admin panel (Settings > AUTH > + ADD PROVIDER). No environment variables needed.

| Field | Description |
|-------|-------------|
| Name | Display name for this provider |
| Host | LDAP server hostname (e.g. `ldap.company.com`) |
| Port | Port number (default: 389, or 636 for LDAPS) |
| TLS | Enable LDAPS |
| Application DN | Service account bind DN (e.g. `CN=svc-app,OU=Service,DC=company,DC=com`) |
| Application DN Password | Service account password |
| Search Base | Where to search for users (e.g. `OU=Users,DC=company,DC=com`) |
| Search Filter | LDAP filter (default: `(sAMAccountName={username})`) |
| Username Attribute | Attribute for username matching (default: `sAMAccountName`) |
| Mail Attribute | Attribute for email (default: `mail`) |
| Group Attribute | Attribute for group membership (default: `memberOf`) |
| Priority | Order for multi-server fallback (lower = tried first) |

### SSO Configuration (via UI)

SSO providers are also configured from Settings > AUTH. Supported types:

| Provider | Required Fields |
|----------|----------------|
| **Keycloak** | Server URL, Realm, Client ID, Client Secret |
| **Google** | Client ID, Client Secret |
| **Microsoft** | Client ID, Client Secret, Tenant ID |

---

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check -- returns status, uptime, DB state, user count |
| POST | `/api/auth/login` | Login (local/LDAP) |
| POST | `/api/auth/logout` | Logout (invalidates session) |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/auth/providers` | List active auth providers (for login page) |
| GET | `/api/auth/oidc/login` | Initiate SSO login (PKCE + CSRF) |
| GET | `/api/auth/oidc/callback` | SSO callback handler |

### Authenticated

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps` | List apps visible to current user |
| POST | `/api/apps/:id/launch` | Log app launch |
| POST | `/api/favorites/:id` | Toggle favorite |

### Admin (super_admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/apps` | List / create apps |
| PUT/DELETE | `/api/admin/apps/:id` | Update / delete app |
| GET/POST | `/api/admin/categories` | List / create categories |
| PUT/DELETE | `/api/admin/categories/:id` | Update / delete category |
| GET/POST | `/api/admin/users` | List / create users |
| PUT | `/api/admin/users/:id/role` | Change user role |
| PUT | `/api/admin/users/:id/status` | Enable/disable user |
| PUT | `/api/admin/users/:id/password` | Reset user password |
| GET/POST | `/api/admin/auth-providers` | List / create auth providers |
| PUT/DELETE | `/api/admin/auth-providers/:id` | Update / delete provider |
| POST | `/api/admin/auth-providers/:id/test` | Test provider connection |
| GET/PUT | `/api/admin/auth-settings` | Get / update auth method toggles (LOCAL/LDAP/SSO enabled) |
| GET/POST | `/api/admin/backups` | List / create database backups |

---

## Docker

### Commands

```bash
docker compose up -d              # Start
docker compose down               # Stop (data safe)
docker compose up -d --build      # Rebuild (data safe)
docker compose restart            # Restart
docker compose logs --tail 50     # Logs
docker compose ps                 # Status (shows healthcheck state)
```

### Healthcheck

The Docker container has a built-in healthcheck that polls `GET /api/health` every 30 seconds. View status with `docker compose ps` (shows `healthy` / `unhealthy`).

### Never run (deletes all data)

```bash
docker compose down -v
docker volume rm city-gpt-superapp-data
```

### Manual backup

```bash
docker cp city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db ./backup-$(date +%Y%m%d).db
```

---

## Upgrade

```bash
cd City-GPT-SuperApp
git pull
docker compose up -d --build
```

All users, apps, settings, auth providers, and logs are preserved. The migration system only adds new tables/columns and never drops existing data.

### Rollback

```bash
# Revert to previous code
git log --oneline -5
git checkout <hash>
docker compose up -d --build

# Or restore a database backup
docker exec city-gpt-superapp-superapp-1 ls /app/frontend/data/backups/
docker cp city-gpt-superapp-superapp-1:/app/frontend/data/backups/<filename> ./restore.db
docker compose down
docker cp ./restore.db city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db
docker compose up -d
```

---

## Reverse Proxy (optional)

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

## Production Checklist

- [ ] Change `SUPER_ADMIN_PASS` in `.env` to a strong password
- [ ] Change the default admin password from the UI after first login
- [ ] Set up Nginx/Caddy reverse proxy with SSL (enables HSTS and Secure cookies automatically)
- [ ] Configure LDAP and/or SSO providers via Settings > AUTH
- [ ] Enable only the auth methods you need (disable LOCAL if using LDAP/SSO exclusively)
- [ ] Review that rate limiting defaults (5/username, 20/IP per 15 min) suit your load
- [ ] Mount the Docker volume for database persistence (default: `city-gpt-superapp-data`)
- [ ] Verify healthcheck is passing: `docker compose ps`
- [ ] Set `JWT_SECRET` explicitly if running multiple app instances behind a load balancer
- [ ] Restrict network access to port 3000 (should only be reachable via reverse proxy)

---

## Settings Panel (6 tabs)

| Tab | What You Can Do |
|-----|----------------|
| **APPS** | Add/edit/delete/disable apps, emoji icons, categories, redirect/embed mode, LDAP group access |
| **CATEGORIES** | Create/edit/delete app categories |
| **USERS** | Create local users, change roles, enable/disable, reset passwords, view login stats |
| **LOGS** | Full audit trail with search and filtering |
| **ANALYTICS** | 35+ insights: active users, trends, top apps, peak hours, per-user stats, system health |
| **AUTH** | Manage auth providers (LDAP/Keycloak/Google/Microsoft), test connections, toggle auth methods on/off |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | SvelteKit 2 + Svelte 5 |
| Styling | Tailwind CSS v4 |
| Database | SQLite 3 (WAL mode) |
| ORM | Drizzle |
| Auth | JWT (jose) + bcrypt + LDAP (ldapjs) + OIDC (PKCE) |
| Deploy | Docker + Node 20 |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can't access app | `docker compose logs --tail 20` |
| Container unhealthy | `docker compose logs` -- check for build or startup errors |
| Login not working | Use LOCAL tab, verify SUPER_ADMIN_PASS in .env |
| Rate limited | Wait 15 minutes or restart the container to clear in-memory state |
| Forgot password | Settings > USERS > RESET PWD (requires another admin) |
| Port in use | Change `"3000:3000"` to `"8080:3000"` in docker-compose.yml |
| LDAP not connecting | Settings > AUTH > TEST button; check host, port, and Application DN |
| SSO redirect fails | Verify Client ID, Client Secret, and callback URL matches `{your-origin}/api/auth/oidc/callback` |
| Apps not showing | Check app status is ACTIVE and user's LDAP group matches app_roles |
| Embed not working | Target app must allow iframing (its X-Frame-Options header) |

---

## License

Internal use only.
