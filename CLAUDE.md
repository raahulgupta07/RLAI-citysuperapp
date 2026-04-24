# CLAUDE.md — City GPT SuperApp

## Overview
City GPT SuperApp is a unified AI agent launcher portal. Super admins configure AI apps, auth providers (LDAP/Keycloak/Local), and user roles from a web UI. Users login, see app cards filtered by their permissions, and launch or embed apps — all from one place.

## Tech Stack
- **Frontend**: SvelteKit 2 + Svelte 5 (runes) + Tailwind CSS v4
- **Database**: SQLite 3 (better-sqlite3 + Drizzle ORM)
- **Auth**: Multi-provider (Local + LDAP + Keycloak SSO) — all configurable from UI
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
│   │   ├── hooks.server.ts         ← Auth hook (loads user on every request)
│   │   ├── lib/
│   │   │   ├── server/
│   │   │   │   ├── db.ts           ← SQLite + Drizzle connection (WAL mode)
│   │   │   │   ├── schema.ts       ← 9 tables: users, apps, categories, app_roles, favorites, app_usage, activity_log, sso_users, auth_providers, settings
│   │   │   │   ├── auth.ts         ← JWT (jose) + LDAP bind + cookie helpers
│   │   │   │   ├── migrate.ts      ← Auto-migration + seed on startup
│   │   │   │   └── activity.ts     ← Activity logging helper
│   │   │   ├── AppCard.svelte      ← Reusable app card (emoji icons, launch/embed)
│   │   │   ├── IconPicker.svelte   ← Emoji icon picker (80+ icons, searchable)
│   │   │   └── index.ts
│   │   └── routes/
│   │       ├── +layout.svelte      ← Navbar (SETTINGS, EXIT), auth guard
│   │       ├── +layout.server.ts   ← Load user, redirect if not auth'd
│   │       ├── login/              ← Terminal-style login (LOCAL/LDAP/SSO tabs, boot animation)
│   │       ├── home/               ← Card grid dashboard (search, category tabs, favorites)
│   │       ├── embed/[slug]/       ← Iframe embed with loading animation
│   │       ├── settings/           ← Admin panel (6 tabs: APPS/CATEGORIES/USERS/LOGS/ANALYTICS/AUTH)
│   │       ├── admin/              ← Legacy alias for settings
│   │       └── api/
│   │           ├── auth/           ← login, logout, me, oidc/*, providers
│   │           ├── apps/           ← user-facing app list + launch logging
│   │           ├── favorites/      ← toggle favorites
│   │           └── admin/          ← CRUD: apps, categories, users, auth-providers, analytics
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
| `users` | User accounts (username, role, auth_source, status, password_hash) |
| `apps` | Registered apps/agents (name, URL, icon, launch_mode, status) |
| `categories` | App categories (AI Agents, Open WebUI, Tools) |
| `app_roles` | LDAP group → app visibility mapping |
| `favorites` | Per-user app favorites |
| `app_usage` | App launch tracking |
| `activity_log` | All user activity (login, logout, app_launch, with IP + user agent) |
| `sso_users` | Keycloak/SSO provider user data |
| `auth_providers` | Auth provider config (LDAP servers, Keycloak instances) — UI-managed |
| `settings` | Portal settings (title, subtitle) |

Auto-migrated on startup. New columns added via ALTER TABLE with try/catch.

## Auth System

### 3 Auth Methods (all configurable from UI)
1. **Local** — username/password stored in SQLite. Registration available.
2. **LDAP** — bind authentication. Multiple LDAP servers supported, tried in priority order.
3. **Keycloak SSO** — OIDC flow. Multiple Keycloak instances supported.

### Auth Provider Management (Settings → AUTH tab)
- Add/edit/delete LDAP and Keycloak providers from UI
- No .env changes needed — DB config takes priority
- TEST button validates LDAP connection or Keycloak OIDC discovery
- Priority ordering for LDAP fallback chain
- Client secrets masked in API responses
- Local Auth always present (can't delete)

### Auth Flow
1. User picks LOCAL/LDAP/SSO on login page
2. LOCAL → check super admin env vars → check DB users with password_hash
3. LDAP → loop through active LDAP providers in priority order → bind attempt
4. SSO → redirect to selected Keycloak instance → OIDC callback → JWT
5. On success: upsert user in DB, set auth_source, sign JWT, set HttpOnly cookie
6. Activity logged: login action with auth method, IP, user agent

### User Roles
- `super_admin` — full access to Settings panel
- `admin` — elevated access (future use)
- `user` — standard user
- `viewer` — read-only (future use)

## Settings Panel (6 tabs)

### APPS — Manage agent cards
- Add/edit/delete apps with name, URL, icon (emoji picker), category, launch mode (redirect/embed), status
- Search + filter by status/mode
- Enable/disable apps with one click
- LDAP group access control per app

### CATEGORIES — Organize apps
- CRUD for categories (AI Agents, Open WebUI, Tools, custom)
- Sort order control

### USERS — User management
- View all users with auth source, role, status, login count, first/last login
- Change role via dropdown (super_admin/admin/user/viewer)
- Enable/disable users
- Reset password (for local users only) — proper modal, not browser prompt
- Search + filter by role/auth/status

### LOGS — Activity audit trail
- All user actions: login, logout, app_launch
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

### AUTH — Auth provider management
- CRUD for LDAP and Keycloak providers
- Test connection button
- Enable/disable providers
- Multiple LDAP servers + multiple Keycloak instances

## Login Page
- Brutalist terminal UI matching City-Dash aesthetic
- Split layout: LEFT = terminal boot animation with robot icon, RIGHT = cream login form
- 3 auth tabs: LOCAL / LDAP / SSO
- Post-login CLI transition: shows operator info, loads each app dynamically from DB
- Register option for local auth

## Home Page
- Card grid with app cards (emoji icon, name, description, launch mode tag)
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

## Activity Logging
Every action is logged to `activity_log`:
- `login` — with auth method (LOCAL/LDAP/SSO), IP, user agent
- `logout` — when user clicks EXIT
- `app_launch` — when user clicks LAUNCH on a card

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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| JWT_SECRET | superapp-dev-secret | JWT signing secret (change in production!) |
| SUPER_ADMIN_USER | admin | Default super admin username |
| SUPER_ADMIN_PASS | admin | Default super admin password |
| LDAP_URL | (empty) | Fallback LDAP URL (prefer UI config) |
| KEYCLOAK_URL | (empty) | Fallback Keycloak URL (prefer UI config) |
| NODE_ENV | development | Set to 'production' in Docker |

**Note**: LDAP and Keycloak are best configured from the UI (Settings → AUTH tab). Env vars serve as fallback only.

## Production Checklist
- [ ] Change JWT_SECRET to a strong random string
- [ ] Change SUPER_ADMIN_PASS to a strong password
- [ ] Configure LDAP/Keycloak providers via Settings → AUTH
- [ ] Set up Nginx/Caddy reverse proxy with SSL
- [ ] Mount SQLite volume for persistence
- [ ] Add your apps via Settings → APPS → + ADD APP
