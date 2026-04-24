# CLAUDE.md — City GPT SuperApp

## Overview
City GPT SuperApp is a unified AI agent launcher portal. Super admins configure AI apps, auth providers (LDAP/SSO/Local), and user roles from a web UI. Users login, see app cards filtered by their permissions, and launch or embed apps — all from one place.

## Tech Stack
- **Frontend**: SvelteKit 2 + Svelte 5 (runes) + Tailwind CSS v4
- **Database**: SQLite 3 (better-sqlite3 + Drizzle ORM)
- **Auth**: Multi-provider (Local + LDAP + SSO via Keycloak/Google/Microsoft) — all configurable from UI
- **Security**: Bcrypt hashing, rate limiting, CORS, CSP, input sanitization, session management
- **Design**: Brutalist aesthetic (Space Grotesk, no border-radius, asymmetric borders, stamp shadows)
- **Deployment**: Docker + Node adapter
- **Port**: 3000

## Project Structure
```
City-GPT-SuperApp/
├── frontend/
│   ├── src/
│   │   ├── app.css                 ← Brutalist design system (from City-Dash)
│   │   ├── app.html                ← HTML + Space Grotesk font
│   │   ├── app.d.ts                ← TypeScript declarations
│   │   ├── hooks.server.ts         ← Auth hook (loads user on every request, security headers, CORS, disabled-user auto-logout)
│   │   ├── lib/
│   │   │   ├── server/
│   │   │   │   ├── db.ts           ← SQLite + Drizzle connection (WAL mode)
│   │   │   │   ├── schema.ts       ← 9 tables: users, apps, categories, app_roles, favorites, app_usage, activity_log, sso_users, auth_providers, settings
│   │   │   │   ├── auth.ts         ← JWT (jose) + LDAP service-account bind + cookie helpers
│   │   │   │   ├── migrate.ts      ← Auto-migration + seed on startup (auth settings seeded)
│   │   │   │   ├── activity.ts     ← Activity logging helper
│   │   │   │   ├── ratelimit.ts    ← Rate limiter (5/username + 20/IP per 15 min window)
│   │   │   │   ├── sanitize.ts     ← Input sanitization (XSS) + URL validation (http/https only)
│   │   │   │   └── session.ts      ← Session management (token blacklist, invalidation on logout)
│   │   │   ├── AppCard.svelte      ← App card (icon, domain, description, info popup, launch/embed)
│   │   │   ├── IconPicker.svelte   ← Emoji icon picker (80+ icons, searchable)
│   │   │   └── index.ts
│   │   └── routes/
│   │       ├── +layout.svelte      ← Navbar (SETTINGS, LOGOUT), auth guard
│   │       ├── +layout.server.ts   ← Load user, redirect if not auth'd
│   │       ├── login/              ← Dynamic login (LOCAL/LDAP/SSO tabs — only enabled methods shown)
│   │       ├── home/               ← Card grid dashboard (search, category tabs, favorites)
│   │       ├── embed/[slug]/       ← Iframe embed with loading animation
│   │       ├── settings/           ← Admin panel (6 tabs: APPS/CATEGORIES/USERS/LOGS/ANALYTICS/AUTH)
│   │       ├── admin/              ← Legacy alias for settings
│   │       └── api/
│   │           ├── auth/           ← login, logout, me, oidc/*, providers
│   │           ├── apps/           ← user-facing app list + launch logging
│   │           ├── favorites/      ← toggle favorites
│   │           ├── health/         ← GET /api/health (Docker healthcheck endpoint)
│   │           └── admin/          ← CRUD: apps, categories, users, auth-providers, auth-settings, analytics
│   ├── data/
│   │   └── superapp.db             ← SQLite database (auto-created)
│   ├── package.json
│   ├── svelte.config.js
│   └── vite.config.ts
├── docs/
│   ├── DESIGN.md                   ← UI/UX spec
│   └── PLAN.md                     ← Implementation plan
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
└── CLAUDE.md
```

## Database (SQLite — 9 tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts (username, role, auth_source, status, password_hash — bcrypt) |
| `apps` | Registered apps/agents (name, URL, icon, launch_mode, status) |
| `categories` | App categories (AI Agents, Open WebUI, Tools) |
| `app_roles` | LDAP group → app visibility mapping |
| `favorites` | Per-user app favorites |
| `app_usage` | App launch tracking |
| `activity_log` | All user activity (login, logout, app_launch, admin actions, with IP + user agent) |
| `sso_users` | SSO provider user data (Keycloak/Google/Microsoft) |
| `auth_providers` | Auth provider config (LDAP servers, Keycloak/Google/Microsoft instances) — UI-managed. CHECK constraint on type removed to support all provider types. |
| `settings` | Portal settings (title, subtitle, auth method toggles). Auth settings seeded on startup. |

Auto-migrated on startup. New columns added via ALTER TABLE with try/catch. Auth settings (LOCAL/LDAP/SSO enable flags) seeded in settings table on first run.

## Auth System

### 3 Auth Methods (all configurable from UI, individually toggleable)
1. **Local** — username/password stored in SQLite with bcrypt hashing. No self-registration (admin creates users only).
2. **LDAP** — service-account bind authentication. Application DN binds first, searches for user, then re-binds with user credentials. Multiple LDAP servers supported, tried in priority order.
3. **SSO** — OIDC flow supporting **Keycloak**, **Google**, and **Microsoft** providers. Multiple instances of each supported.

### Auth Method Toggles
- Each method (LOCAL, LDAP, SSO) can be independently enabled/disabled from Settings > AUTH
- Login page dynamically shows only enabled methods as tabs
- At least one method must remain enabled

### Auth Provider Management (Settings → AUTH tab)
- **Auth method toggles**: enable/disable LOCAL, LDAP, SSO independently
- **4 provider types**: LDAP, Keycloak, Google, Microsoft
- Add/edit/delete providers from UI
- No .env changes needed — DB config takes priority
- TEST button validates LDAP connection or OIDC discovery
- Priority ordering for LDAP fallback chain
- Client secrets masked in API responses

### LDAP Configuration Fields
- Host, Port
- Application DN (service account for bind+search)
- Application DN Password
- Mail Attribute
- Username Attribute
- Search Base
- Search Filter
- Group Attribute
- TLS toggle (on/off)

### LDAP Bind Flow
1. Bind with Application DN + Application DN Password (service account)
2. Search for user by username using Search Base + Search Filter
3. Re-bind with found user's DN + user-entered password
4. Extract attributes (mail, groups) from search result

### SSO / OIDC Flow
- Supports Keycloak, Google, Microsoft providers
- CSRF protection via `state` parameter
- PKCE S256 challenge/verifier
- Hardcoded redirect URI (no dynamic construction)
- Per-provider buttons with brand icons on login page

### Auth Flow
1. User picks LOCAL/LDAP/SSO on login page (only enabled methods shown)
2. LOCAL → check super admin env vars → check DB users with bcrypt password_hash
3. LDAP → loop through active LDAP providers in priority order → service-account bind → search → user bind
4. SSO → redirect to selected provider (Keycloak/Google/Microsoft) → OIDC callback with PKCE + state → JWT
5. On success: upsert user in DB, set auth_source, sign JWT, set HttpOnly cookie
6. Disabled user check on login (rejected) + on every request (auto-logout)
7. Activity logged: login action with auth method, IP, user agent

### User Roles
- `super_admin` — full access to Settings panel
- `admin` — elevated access (future use)
- `user` — standard user
- `viewer` — read-only (future use)

## Security

### Password Security
- **Bcrypt hashing** via bcryptjs (10 salt rounds)
- Auto-migration of legacy plain-text passwords to bcrypt on login
- **Password policy**: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number

### Rate Limiting
- 5 failed attempts per username per 15-minute window
- 20 failed attempts per IP per 15-minute window
- Returns 429 Too Many Requests with retry-after hint

### Session Management
- JWT-based sessions with HttpOnly cookies
- Token blacklist — tokens invalidated on logout
- Disabled user auto-logout enforced on every request via hooks.server.ts

### Security Headers (hooks.server.ts)
- `Content-Security-Policy` — restrictive CSP
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — restrictive feature policy
- `Strict-Transport-Security` — HSTS enabled in production

### CORS
- Cross-origin mutating API requests (POST/PUT/DELETE) rejected
- Origin checked against request host

### Input Sanitization
- XSS sanitization on app name, description, URL fields
- URL validation enforces http/https scheme only

### Secrets Handling
- Client secrets and passwords masked in API responses
- Default credential security warning banner shown to super admin

## Settings Panel (6 tabs)

### APPS — Manage agent cards
- Add/edit/delete apps with name, URL, icon (emoji picker), category, launch mode (redirect/embed), status
- Search + filter by status/mode
- Enable/disable apps with one click
- LDAP group access control per app
- Input sanitization on name/description/URL

### CATEGORIES — Organize apps
- CRUD for categories (AI Agents, Open WebUI, Tools, custom)
- Sort order control

### USERS — User management
- **+ CREATE USER** — create local users with username, display name, email, password, role
- Password policy enforced (8+ chars, 1 upper, 1 lower, 1 number)
- View all users with auth source, role, status, login count, first/last login
- Change role via dropdown (super_admin/admin/user/viewer)
- Enable/disable users
- Reset password (for local users only) — proper modal, not browser prompt
- Search + filter by role/auth/status
- API: POST /api/admin/users (create), PUT .../role, PUT .../status, PUT .../password

### LOGS — Activity audit trail
- All user actions: login, logout, app_launch
- All admin actions logged (user create/edit, app CRUD, provider changes, auth setting changes)
- Timestamp, user, action (color-coded), detail, IP address
- Search + filter by action type

### ANALYTICS — 35+ insights
- **Key metrics**: total apps, users, launches, activities
- **Active users**: 7-day, 30-day, retained, never-launched
- **Activity period**: today, this week, this month
- **Averages**: logins/user, launches/user, apps with zero launches
- **ASCII bar charts**: top apps, least used, launches by category, mode usage, users by auth, users by role, activity breakdown, peak hours
- **30-day trends**: logins per day, launches per day
- **Weekday heatmap**: logins by weekday
- **Per-user table**: logins, launches, total actions, last active
- **System health**: table record counts, app/user status breakdown

### AUTH — Auth provider & method management
- **Auth method toggles**: enable/disable LOCAL, LDAP, SSO independently (switches)
- **4 provider types**: LDAP, Keycloak, Google, Microsoft
- Add/edit/delete providers with all relevant fields
- LDAP fields: Host, Port, Application DN, Application DN Password, Mail Attribute, Username Attribute, Search Base, Search Filter, Group Attribute, TLS toggle
- Test connection button
- Enable/disable individual providers
- Multiple LDAP servers + multiple SSO instances
- API: GET/PUT /api/admin/auth-settings (toggle methods), CRUD /api/admin/auth-providers

## Login Page
- Brutalist terminal UI matching City-Dash aesthetic
- Split layout: LEFT = terminal boot animation with robot icon, RIGHT = cream login form
- **Dynamic auth tabs** — only enabled methods shown (LOCAL / LDAP / SSO)
- **Remember me checkbox** — 30 days if checked, 24 hours if unchecked
- **No self-registration** — admin creates all user accounts
- **SSO tab** shows per-provider buttons with brand icons (Google, Microsoft, Keycloak)
- Post-login CLI transition: shows operator info, loads each app dynamically from DB
- **LOGOUT** button (not EXIT) in navbar after login
- **Security warning banner** shown when using default admin/admin credentials

## Home Page
- Card grid with app cards:
  - 32px emoji icon, app name, domain URL, category label
  - 2-line truncated description with (i) info button for full details popup
  - Color accent left border (card_color), REDIRECT/EMBED tag
  - LAUNCH/OPEN button + favorite star toggle
- Category tabs (ALL + per-category + FAVORITES)
- Search bar (client-side filter)
- Favorite toggle per card
- Boot animation on first load
- Cards filtered by user's LDAP groups

## Embed Mode
- Apps with launch_mode='embed' load inside the portal via iframe
- Loading animation while iframe loads
- Back button to return to home
- Navbar stays visible

## Health Check
- `GET /api/health` — returns `{ status: "ok" }` with 200
- Docker healthcheck configured in Dockerfile (`HEALTHCHECK` instruction)
- Used for container orchestration readiness/liveness probes

## Activity & Audit Logging
Every action is logged to `activity_log`:
- `login` — with auth method (LOCAL/LDAP/SSO), IP, user agent
- `logout` — when user clicks LOGOUT
- `app_launch` — when user clicks LAUNCH on a card
- **Admin actions** — user create/edit/disable, app CRUD, category changes, auth provider changes, auth setting toggles — all logged with actor, action, detail, IP

## Design System (from City-Dash)
- **Colors**: cream (#feffd6), neon green (#00fc40), dark (#1a1a2e)
- **Font**: Space Grotesk (400, 700, 900)
- **No border-radius** — `* { border-radius: 0px !important; }`
- **Asymmetric borders**: 2px top/left, 4px right/bottom
- **Stamp shadows**: 4px 4px 0px 0px (no blur)
- **Hover**: translate(-2px, -2px) + shadow pop

### Key CSS Classes
`.ink-border` `.stamp-shadow` `.tag-label` `.dark-title-bar` `.dash-tabs` `.dash-tab` `.app-card` `.btn-primary` `.btn-green` `.btn-ghost` `.btn-error` `.form-input` `.form-select` `.form-label` `.modal-overlay` `.modal-body` `.navbar` `.card-grid` `.admin-table` `.toast`

## Commands

```bash
# Development
cd frontend && npm install && npm run dev

# Production (Docker)
docker compose up -d --build

# Rebuild after changes
npm run build --prefix frontend && docker compose up -d --build

# Fresh database (deletes all data)
rm -f frontend/data/superapp.db && docker compose down && docker volume rm city-gpt-superapp_superapp-data && docker compose up -d --build
```

## Default Login
- **Username**: admin
- **Password**: admin
- **Role**: super_admin
- Security warning banner shown until default credentials are changed

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| JWT_SECRET | superapp-dev-secret | JWT signing secret (change in production!) |
| SUPER_ADMIN_USER | admin | Default super admin username |
| SUPER_ADMIN_PASS | admin | Default super admin password |
| LDAP_URL | (empty) | Fallback LDAP URL (prefer UI config) |
| KEYCLOAK_URL | (empty) | Fallback Keycloak URL (prefer UI config) |
| NODE_ENV | development | Set to 'production' in Docker |

**Note**: LDAP and SSO providers are best configured from the UI (Settings → AUTH tab). Env vars serve as fallback only.

## Production Checklist
- [ ] Change JWT_SECRET to a strong random string
- [ ] Change SUPER_ADMIN_PASS to a strong password
- [ ] Configure LDAP/SSO providers via Settings → AUTH
- [ ] Set up Nginx/Caddy reverse proxy with SSL
- [ ] Mount SQLite volume for persistence
- [ ] Add your apps via Settings → APPS → + ADD APP
- [ ] Verify health endpoint: `curl http://localhost:3000/api/health`
- [ ] Review security headers in production
