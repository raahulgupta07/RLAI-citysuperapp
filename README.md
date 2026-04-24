# City GPT SuperApp

Unified AI agent launcher portal. One login, all your AI apps in one place.

## Features

- **Multi-Auth** — Local + LDAP + Keycloak SSO, all configurable from UI
- **App Cards** — Add/manage AI agents with emoji icons, categories, embed/redirect modes
- **Role-Based Access** — LDAP group filtering, user roles (super_admin/admin/user/viewer)
- **Embed Mode** — Run apps inside the portal via iframe
- **Activity Logging** — Track every login, logout, app launch with IP + user agent
- **35+ Analytics** — Usage trends, top apps, peak hours, per-user stats, system health
- **Auth Provider Management** — Add multiple LDAP servers and Keycloak instances from UI
- **Auto-Backup** — Database backed up automatically before every upgrade
- **Brutalist UI** — City-Dash design system (Space Grotesk, stamp shadows, no rounded corners)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | SvelteKit 2 + Svelte 5 + Tailwind v4 |
| Database | SQLite 3 (better-sqlite3 + Drizzle ORM) |
| Auth | JWT + LDAP + Keycloak OIDC |
| Deploy | Docker + Node.js 20 |
| Port | 3000 |

---

# FRESH INSTALL (First Time on a New Server)

## Prerequisites

Your server needs:
- **Docker** — version 20+
- **Docker Compose** — version 2+ (comes with Docker Desktop, or install `docker-compose-plugin`)
- **Git** — to clone the repo
- **Port 3000** — must be free (or you change it later)

To check:
```bash
docker --version          # Should show Docker version 20+
docker compose version    # Should show v2+
git --version             # Should show git version
```

If Docker is not installed:
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and log back in

# CentOS/RHEL
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
```

## Step 1: Clone the Repository

```bash
git clone <repo-url> City-GPT-SuperApp
cd City-GPT-SuperApp
```

## Step 2: Create the Environment File

```bash
cp .env.example .env
```

Now open `.env` in any editor (nano, vim, etc):
```bash
nano .env
```

Change these values:

```bash
# ⚠️  MUST CHANGE — this signs all login tokens
# Generate with: openssl rand -hex 32
JWT_SECRET=paste-your-64-character-random-string-here

# ⚠️  MUST CHANGE — this is the admin password for first login
SUPER_ADMIN_PASS=YourStrongPassword123

# Optional — change admin username (default is "admin")
SUPER_ADMIN_USER=admin
```

Generate a secure JWT secret:
```bash
openssl rand -hex 32
# Copy the output and paste it as JWT_SECRET
```

Save and close the file (`Ctrl+X`, then `Y`, then `Enter` in nano).

## Step 3: Build and Start the Container

```bash
docker compose up -d --build
```

This will:
1. Download Node.js 20 base image (~200MB, first time only)
2. Install dependencies
3. Build the frontend
4. Start the container on port 3000

**First build takes 2-3 minutes.** Subsequent rebuilds are faster.

## Step 4: Verify It's Running

```bash
docker compose logs --tail 10
```

You should see:
```
superapp-1  | Listening on http://0.0.0.0:3000
```

Also check the container status:
```bash
docker compose ps
```

Should show `running` status.

Quick test:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
# Should print: 200
```

## Step 5: Open in Browser and Login

```
URL:      http://your-server-ip:3000
Username: admin  (or whatever you set in SUPER_ADMIN_USER)
Password: YourStrongPassword123  (whatever you set in SUPER_ADMIN_PASS)
```

You will see:
1. Login page with terminal boot animation
2. Enter credentials → pick LOCAL tab → click INITIATE_AUTHENTICATION
3. CLI transition showing agents loading
4. Home page (empty — no apps added yet)

## Step 6: Initial Configuration

Do these in order after first login:

### 6a. Change Admin Password (if using default)
```
Click SETTINGS button (top right) → USERS tab → find "admin" row → click RESET PWD
Enter a new strong password → click RESET PASSWORD
```

### 6b. Configure Authentication Providers
```
SETTINGS → AUTH tab → click + ADD PROVIDER

For LDAP:
  - Type: LDAP
  - Name: "Corp LDAP" (any name you want)
  - LDAP URL: ldap://your-ldap-server:389
  - Bind DN: uid={username},ou=users,dc=company,dc=com
  - Search Base: ou=users,dc=company,dc=com
  - Click SAVE PROVIDER
  - Click TEST to verify connection

For Keycloak SSO:
  - Type: KEYCLOAK
  - Name: "Corp SSO" (any name)
  - Keycloak URL: https://sso.company.com
  - Realm: master (or your realm name)
  - Client ID: city-ai-hub (create this in Keycloak first)
  - Client Secret: (from Keycloak client credentials)
  - Click SAVE PROVIDER
  - Click TEST to verify

You can add multiple LDAP servers and multiple Keycloak instances.
```

### 6c. Add App Categories
```
SETTINGS → CATEGORIES tab

Default categories: AI Agents, Open WebUI, Tools
To add more: click + ADD → enter name → click SAVE
```

### 6d. Add Your Apps
```
SETTINGS → APPS tab → click + ADD APP

Fill in:
  - App Name: "RO-ED Command Center"
  - App URL: https://pgro.citygpt.xyz
  - Description: "Route-to-Market outlet management"
  - Category: AI Agents
  - Icon: click to pick an emoji (🤖, ⚡, 📊, etc.)
  - Launch Mode:
      REDIRECT = opens in new browser tab
      EMBED = opens inside the portal (iframe)
  - Access: check which LDAP groups can see this app
  - Status: ACTIVE
  - Click SAVE APP

Repeat for each app you want to add.
```

### 6e. Add More Users (optional)
Users are created automatically when they login via LDAP or SSO.
For local users: they can register on the login page (LOCAL tab → "NEW USER? REGISTER").
You can also manage users in SETTINGS → USERS tab (change roles, disable, reset passwords).

## Step 7: Setup Reverse Proxy (Production)

If you want to access the app via a domain name with SSL:

### Nginx
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
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Caddy (auto-SSL)
```
apps.yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Custom Port
If port 3000 is taken, edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"    # Change 8080 to any free port
```
Then rebuild: `docker compose up -d --build`

---

# UPDATE (When New Code is Available)

## Before You Update

Your data is stored in a Docker volume called `city-gpt-superapp-data`. This volume is **separate from the container**. Rebuilding the container does NOT delete your data.

The app also auto-backs up the database every time it starts.

## How to Update

```bash
# Go to project folder
cd City-GPT-SuperApp

# Pull latest code
git pull

# Rebuild and restart (your data stays safe)
docker compose up -d --build
```

**That's it. 2 commands.** All your users, apps, settings, auth providers, and logs are preserved.

## Verify After Update

```bash
# Check container is running
docker compose ps

# Check logs for errors
docker compose logs --tail 10

# Should see: Listening on http://0.0.0.0:3000
```

Then open your browser and confirm everything works.

## What Happens During Update (technical detail)

```
Step 1: git pull
  → Downloads new source code files
  → Does NOT touch the database

Step 2: docker compose up -d --build
  → Builds a NEW container image from the new code
  → Stops the OLD container
  → Starts the NEW container
  → Mounts the SAME Docker volume (your database)
  → App starts up:
    → Auto-backs up database to data/backups/
    → Runs migrations:
      → CREATE TABLE IF NOT EXISTS (skips if table exists)
      → ALTER TABLE ADD COLUMN (skips if column exists)
      → Seed data only if table is empty
    → NO tables dropped, NO data deleted, NO rows modified
  → App is ready on port 3000
```

---

# ROLLBACK (If Update Goes Wrong)

## Option 1: Go Back to Previous Code

```bash
# See recent commits
git log --oneline -10

# Go back to a specific version
git checkout <commit-hash>

# Rebuild
docker compose up -d --build
```

## Option 2: Restore Database from Auto-Backup

The app creates a backup every time it starts. Backups are inside the Docker volume.

```bash
# List available backups
docker exec city-gpt-superapp-superapp-1 ls -la /app/frontend/data/backups/

# Pick a backup and copy it out
docker cp city-gpt-superapp-superapp-1:/app/frontend/data/backups/superapp_2026-04-23T16-21-31_pre-migrate.db ./restore.db

# Stop the container
docker compose down

# Copy backup back in as the main database
docker cp ./restore.db city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db

# Start again
docker compose up -d
```

## Option 3: Manual Backup Restore

If you previously made a manual backup:
```bash
docker compose down
docker cp ./my-manual-backup.db city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db
docker compose up -d
```

---

# DATA SAFETY

## Where Your Data Lives

| What | Where | Survives Container Rebuild? |
|------|-------|---------------------------|
| Database (users, apps, settings, logs) | Docker volume `city-gpt-superapp-data` | YES |
| Auto-backups (last 10) | Inside Docker volume at `data/backups/` | YES |
| Source code | Git repo on disk | YES |
| Container image | Docker cache | Rebuilt each time |

## Safe Commands (use these freely)

```bash
docker compose up -d              # Start
docker compose down               # Stop (data stays)
docker compose up -d --build      # Rebuild (data stays)
docker compose restart            # Restart
docker compose logs               # View logs
docker compose logs --tail 50     # Last 50 lines
docker compose logs -f            # Follow logs live
docker compose ps                 # Check status
docker compose exec superapp sh   # Shell into container
```

## DANGEROUS Commands (NEVER run these unless you want to lose everything)

```bash
# ❌ DELETES ALL DATA — the -v flag removes volumes
docker compose down -v

# ❌ DELETES ALL DATA — removes the named volume
docker volume rm city-gpt-superapp-data

# ❌ DELETES ALL DATA — removes database file
docker exec city-gpt-superapp-superapp-1 rm /app/frontend/data/superapp.db
```

## Manual Backup (before risky operations)

```bash
# Backup database to your local machine
docker cp city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db \
  ./superapp-backup-$(date +%Y%m%d-%H%M%S).db

# Backup ALL data including auto-backups
docker cp city-gpt-superapp-superapp-1:/app/frontend/data/ ./data-backup-$(date +%Y%m%d)/
```

## Scheduled Backup (cron)

Add to crontab (`crontab -e`):
```bash
# Backup SuperApp database every day at 2 AM
0 2 * * * docker cp city-gpt-superapp-superapp-1:/app/frontend/data/superapp.db /backups/superapp-$(date +\%Y\%m\%d).db
```

---

# SETTINGS REFERENCE

## APPS Tab
- **+ ADD APP** — opens form: name, URL, icon, category, launch mode, access groups, status
- **EDIT** — modify any app
- **DISABLE/ENABLE** — toggle app visibility (disabled apps hidden from users)
- **DEL** — permanently delete (requires typing app name to confirm)
- **Search** — filter by name/URL/description
- **Filters** — by status (active/disabled/draft) and mode (redirect/embed)

## CATEGORIES Tab
- **+ ADD** — create new category
- **EDIT** — rename category
- **DEL** — delete (only if no apps use it)
- Default categories: AI Agents, Open WebUI, Tools

## USERS Tab
- **Role dropdown** — change between super_admin, admin, user, viewer
- **DISABLE/ENABLE** — block/unblock user login
- **RESET PWD** — set new password (local users only, opens modal)
- **Columns** — username, display name, auth source, role, status, login count, first login, last login
- **Search** — filter by username/name/email
- **Filters** — by role, auth method (local/ldap/sso), status

## LOGS Tab
- Shows all user activity: login, logout, app_launch
- **Columns** — timestamp, user, action (color-coded), detail, IP address
- **Search** — filter by username or detail
- **Filters** — by action type

## ANALYTICS Tab
- **8 key metric cards** — total apps, users, launches, activities, active 7d/30d, retained, never launched
- **3 period cards** — actions today, this week, this month
- **3 average cards** — avg logins/user, avg launches/user, zero-launch apps
- **8 ASCII bar charts** — top apps, least used, by category, by mode, by auth, by role, activity breakdown, peak hours
- **2 trend charts** — logins per day, launches per day (30 days)
- **Weekday chart** — logins by day of week
- **Per-user table** — logins, launches, total actions, last active
- **System health** — row counts for all database tables

## AUTH Tab
- **+ ADD PROVIDER** — add LDAP server or Keycloak instance
- **EDIT** — update provider config
- **TEST** — verify LDAP connection or Keycloak OIDC discovery
- **DEL** — remove provider (cannot delete Local Auth)
- **LDAP fields** — URL, bind DN, search base, search filter, group attribute
- **Keycloak fields** — URL, realm, client ID, client secret
- Supports multiple LDAP + multiple Keycloak simultaneously

---

# ENVIRONMENT VARIABLES

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `JWT_SECRET` | superapp-dev-secret | **YES** | Signs login tokens. Must be changed in production. Use `openssl rand -hex 32` to generate. |
| `SUPER_ADMIN_USER` | admin | No | Username for the default super admin account. Created on first boot. |
| `SUPER_ADMIN_PASS` | admin | **YES** | Password for the default super admin. Change to a strong password. |
| `NODE_ENV` | production | No | Leave as `production`. Only change to `development` for local dev. |
| `LDAP_URL` | (empty) | No | Fallback LDAP server URL. Not needed if you configure LDAP from the UI. |
| `LDAP_BIND_DN` | (empty) | No | Fallback LDAP bind DN template. |
| `LDAP_SEARCH_BASE` | (empty) | No | Fallback LDAP search base. |
| `KEYCLOAK_URL` | (empty) | No | Fallback Keycloak URL. Not needed if you configure Keycloak from the UI. |
| `KEYCLOAK_REALM` | master | No | Fallback Keycloak realm. |
| `KEYCLOAK_CLIENT_ID` | (empty) | No | Fallback Keycloak client ID. |
| `KEYCLOAK_CLIENT_SECRET` | (empty) | No | Fallback Keycloak client secret. |

**Note:** LDAP and Keycloak settings in `.env` are fallbacks only. The recommended way is to configure them from the UI (Settings → AUTH tab). UI config takes priority over `.env`.

---

# TROUBLESHOOTING

| Problem | What to Do |
|---------|-----------|
| **Can't access http://server:3000** | Check: `docker compose ps` — is container running? Check: `docker compose logs --tail 20` for errors. Check: is port 3000 open in firewall? |
| **Container keeps restarting** | Run `docker compose logs` — look for error messages. Usually a build error or missing .env file. |
| **Login not working** | Make sure you're using the correct SUPER_ADMIN_USER and SUPER_ADMIN_PASS from your .env file. Try LOCAL tab. |
| **Forgot admin password** | Settings → USERS → admin → RESET PWD. If you can't login at all, you must reset the database (WARNING: loses all data): `docker exec city-gpt-superapp-superapp-1 rm /app/frontend/data/superapp.db && docker compose restart` |
| **LDAP not connecting** | Settings → AUTH → click TEST on your LDAP provider. Check URL, port, bind DN. Make sure the server is reachable from the Docker container. |
| **Keycloak SSO not working** | Settings → AUTH → click TEST. Make sure the Keycloak URL is reachable, realm exists, client ID is correct. Check that redirect URI matches. |
| **Port 3000 already in use** | Change port in `docker-compose.yml`: `"8080:3000"` (use any free port). Then rebuild: `docker compose up -d --build` |
| **Build fails** | Run `docker compose build --no-cache` to rebuild from scratch. Check if you have enough disk space. |
| **Apps not showing on home page** | Check: is the app status ACTIVE? (Settings → APPS). Check: does the user's LDAP group match the app's access groups? |
| **Embed not working** | The target app must allow iframing. It needs to set `X-Frame-Options: ALLOWALL` or `Content-Security-Policy: frame-ancestors *` in its headers. |
| **Want to see all container output** | `docker compose logs -f` (follows live). Press Ctrl+C to stop. |

---

# DEVELOPMENT (For Developers Only)

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

Build for production locally:
```bash
npm run build
node build
```

## License

Internal use only.
