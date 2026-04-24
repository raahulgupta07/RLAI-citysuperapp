# City GPT SuperApp — Implementation Plan

## Tech Stack

| Layer          | Choice                                    |
|----------------|-------------------------------------------|
| Frontend       | SvelteKit 2 + Svelte 5 (same as City-Dash)|
| Styling        | Tailwind CSS v4 + City-Dash brutalist CSS  |
| Font           | Space Grotesk (Google Fonts)               |
| Backend        | SvelteKit API routes (server-side)         |
| Database       | SQLite 3 (via better-sqlite3)              |
| ORM            | Drizzle ORM (lightweight, type-safe)       |
| Auth           | LDAP bind + JWT (HttpOnly cookie)          |
| Deployment     | Docker (Nginx + Node)                      |

## Database Schema (SQLite)

```sql
-- Users (synced from LDAP on login)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK(role IN ('super_admin','admin','user')),
  ldap_groups TEXT DEFAULT '[]',  -- JSON array
  last_login TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- App categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Apps (the cards)
CREATE TABLE apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id),
  url TEXT NOT NULL,
  icon TEXT DEFAULT '',
  card_color TEXT DEFAULT '#007518',
  launch_mode TEXT DEFAULT 'redirect' CHECK(launch_mode IN ('redirect','embed')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active','draft','disabled')),
  sort_order INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Which LDAP groups can see which apps
CREATE TABLE app_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
  ldap_group TEXT NOT NULL
);

-- User favorites
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
  UNIQUE(user_id, app_id)
);

-- Usage tracking
CREATE TABLE app_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  app_id INTEGER REFERENCES apps(id),
  action TEXT DEFAULT 'launch',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Portal settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);
```

## API Routes

```
AUTH:
  POST /api/auth/login      → LDAP bind, create JWT, upsert user in DB
  POST /api/auth/logout     → clear cookie
  GET  /api/auth/me         → current user from JWT

USER-FACING:
  GET  /api/apps            → apps filtered by user's LDAP groups
  POST /api/apps/:id/launch → log usage
  GET  /api/favorites       → user's favorites
  POST /api/favorites/:id   → toggle favorite

ADMIN (super_admin only):
  GET    /api/admin/apps           → all apps
  POST   /api/admin/apps           → create app
  PUT    /api/admin/apps/:id       → update app
  DELETE /api/admin/apps/:id       → delete app
  PUT    /api/admin/apps/reorder   → batch update sort_order

  GET    /api/admin/categories     → list
  POST   /api/admin/categories     → create
  PUT    /api/admin/categories/:id → update
  DELETE /api/admin/categories/:id → delete

  GET    /api/admin/users          → all users
  PUT    /api/admin/users/:id/role → change role

  GET    /api/admin/analytics      → usage stats
  GET    /api/admin/settings       → portal settings
  PUT    /api/admin/settings       → update settings
```

## Folder Structure

```
City-GPT-SuperApp/
├── docs/
│   ├── DESIGN.md              ← UI/UX spec (this file)
│   └── PLAN.md                ← this plan
├── frontend/
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── src/
│   │   ├── app.html
│   │   ├── app.css            ← City-Dash brutalist design system
│   │   ├── app.d.ts
│   │   ├── lib/
│   │   │   ├── server/
│   │   │   │   ├── db.ts          ← SQLite connection + Drizzle
│   │   │   │   ├── schema.ts      ← Drizzle schema definitions
│   │   │   │   ├── auth.ts        ← JWT + LDAP helpers
│   │   │   │   └── migrate.ts     ← auto-migration on startup
│   │   │   ├── AppCard.svelte     ← reusable app card component
│   │   │   ├── AdminAppForm.svelte ← add/edit app form
│   │   │   └── index.ts
│   │   └── routes/
│   │       ├── +layout.svelte         ← navbar, auth check, theme
│   │       ├── +layout.server.ts      ← load user from cookie
│   │       ├── +page.svelte           ← redirect to /home
│   │       ├── login/
│   │       │   └── +page.svelte       ← terminal login
│   │       ├── home/
│   │       │   ├── +page.svelte       ← card grid dashboard
│   │       │   └── +page.server.ts    ← load apps for user
│   │       ├── embed/[slug]/
│   │       │   ├── +page.svelte       ← iframe embed view
│   │       │   └── +page.server.ts    ← load app by slug
│   │       ├── admin/
│   │       │   ├── +page.svelte       ← admin panel (tabs)
│   │       │   ├── +page.server.ts    ← load all apps/cats/users
│   │       │   └── +layout.server.ts  ← super_admin guard
│   │       └── api/
│   │           ├── auth/
│   │           │   ├── login/+server.ts
│   │           │   ├── logout/+server.ts
│   │           │   └── me/+server.ts
│   │           ├── apps/
│   │           │   └── +server.ts
│   │           ├── favorites/
│   │           │   └── [id]/+server.ts
│   │           └── admin/
│   │               ├── apps/
│   │               │   ├── +server.ts
│   │               │   ├── [id]/+server.ts
│   │               │   └── reorder/+server.ts
│   │               ├── categories/
│   │               │   ├── +server.ts
│   │               │   └── [id]/+server.ts
│   │               ├── users/
│   │               │   └── [id]/role/+server.ts
│   │               ├── analytics/+server.ts
│   │               └── settings/+server.ts
│   └── data/
│       └── superapp.db        ← SQLite database file
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Implementation Phases

### Phase 0: Project Setup
- P0.1: Init SvelteKit project with Svelte 5 + Tailwind v4
- P0.2: Copy City-Dash app.css design system
- P0.3: Add SQLite + Drizzle ORM
- P0.4: Create DB schema + auto-migration
- P0.5: Add .env config

### Phase 1: Auth
- P1.1: LDAP login API endpoint
- P1.2: JWT sign/verify helpers
- P1.3: Login page (terminal boot UI)
- P1.4: Layout with auth guard + navbar
- P1.5: Logout + user session

### Phase 2: Card Dashboard (user-facing)
- P2.1: Apps API — fetch apps filtered by role
- P2.2: AppCard component (brutalist style)
- P2.3: Home page — card grid with categories
- P2.4: Category tabs (filter by category)
- P2.5: Search (client-side filter)
- P2.6: Favorites (toggle + favorites tab)

### Phase 3: Admin Panel
- P3.1: Admin layout + super_admin guard
- P3.2: Apps tab — list all apps in table
- P3.3: Add App form/modal
- P3.4: Edit App form/modal
- P3.5: Delete App with confirmation
- P3.6: Drag-to-reorder apps
- P3.7: Categories tab — CRUD
- P3.8: Users tab — list + role toggle

### Phase 4: Embed Mode
- P4.1: Embed page with iframe
- P4.2: Loading state while iframe loads
- P4.3: Back button navigation
- P4.4: Embed vs redirect logic on card click

### Phase 5: Polish
- P5.1: Dark mode toggle
- P5.2: Usage logging (app launches)
- P5.3: Analytics tab in admin
- P5.4: Portal settings tab
- P5.5: Responsive (mobile/tablet)
- P5.6: Seed DB with current apps
- P5.7: Docker setup
