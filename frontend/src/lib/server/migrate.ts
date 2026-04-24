import type Database from 'better-sqlite3';
import { createBackup } from './backup.js';

export function migrate(sqlite: Database.Database) {
  // Auto-backup before any migration
  createBackup('pre-migrate');

  // SAFETY: All seed data uses IF NOT EXISTS / IF empty checks
  // NEVER use DROP TABLE, DELETE FROM, or TRUNCATE in migrations
  // ALWAYS use ALTER TABLE ... ADD COLUMN with try/catch for new columns
  // This ensures existing data is NEVER deleted during upgrades

  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      password_hash TEXT DEFAULT '',
      role TEXT DEFAULT 'user' CHECK(role IN ('super_admin','admin','user','viewer')),
      ldap_groups TEXT DEFAULT '[]',
      last_login TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS apps (
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

    CREATE TABLE IF NOT EXISTS app_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
      ldap_group TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
      UNIQUE(user_id, app_id)
    );

    CREATE TABLE IF NOT EXISTS app_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      app_id INTEGER REFERENCES apps(id),
      action TEXT DEFAULT 'launch',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      detail TEXT DEFAULT '',
      app_id INTEGER REFERENCES apps(id),
      ip_address TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sso_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT DEFAULT 'keycloak',
      provider_user_id TEXT DEFAULT '',
      provider_email TEXT DEFAULT '',
      provider_data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add password_hash column if missing (migration for existing DBs)
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''`);
  } catch {
    // Column already exists — ignore
  }

  // Add new columns to users (ignore if already exist)
  try { sqlite.exec("ALTER TABLE users ADD COLUMN auth_source TEXT DEFAULT 'local'"); } catch {}
  try { sqlite.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'"); } catch {}

  // Migration: remove CHECK constraint on auth_providers.type to allow google/microsoft
  // SQLite can't ALTER CHECK, so we recreate the table if the old constraint exists
  try {
    const tableInfo = sqlite.prepare("SELECT sql FROM sqlite_master WHERE name='auth_providers'").get() as any;
    if (tableInfo?.sql && tableInfo.sql.includes("ldap','keycloak','local'")) {
      console.log('[MIGRATE] Removing CHECK constraint on auth_providers.type...');
      // Disable foreign keys temporarily for table recreation
      sqlite.pragma('foreign_keys = OFF');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS auth_providers_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config TEXT DEFAULT '{}',
          status TEXT DEFAULT 'active',
          priority INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO auth_providers_new SELECT * FROM auth_providers;
        DROP TABLE auth_providers;
        ALTER TABLE auth_providers_new RENAME TO auth_providers;
      `);
      sqlite.pragma('foreign_keys = ON');
      console.log('[MIGRATE] auth_providers CHECK constraint removed successfully');
    }
  } catch (e) {
    console.error('[MIGRATE] Failed to migrate auth_providers:', e);
  }

  // Seed default categories if empty
  const catCount = sqlite.prepare('SELECT COUNT(*) as c FROM categories').get() as any;
  if (catCount.c === 0) {
    const insertCat = sqlite.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    insertCat.run('AI Agents', 1);
    insertCat.run('Open WebUI', 2);
    insertCat.run('Tools', 3);
  }

  // Seed default super admin if no users
  const userCount = sqlite.prepare('SELECT COUNT(*) as c FROM users').get() as any;
  if (userCount.c === 0) {
    sqlite.prepare('INSERT INTO users (username, display_name, role) VALUES (?, ?, ?)').run('admin', 'Super Admin', 'super_admin');
  }

  // Seed default settings
  const settingsCount = sqlite.prepare('SELECT COUNT(*) as c FROM settings').get() as any;
  if (settingsCount.c === 0) {
    const insertSetting = sqlite.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('portal_title', 'City AI Hub');
    insertSetting.run('portal_subtitle', 'AI Command Center');
    insertSetting.run('default_theme', 'light');
  }

  // Seed auth method toggles (INSERT OR IGNORE — only runs on first boot)
  // Default: only LOCAL enabled, admin turns on LDAP/SSO after configuring providers
  const insertSetting2 = sqlite.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting2.run('auth_local_enabled', 'true');
  insertSetting2.run('auth_ldap_enabled', 'false');
  insertSetting2.run('auth_sso_enabled', 'false');

  // Migration: if auth toggles were seeded as 'true' from an older version,
  // set LDAP/SSO to false unless there are active providers configured
  const ldapCount = sqlite.prepare("SELECT COUNT(*) as c FROM auth_providers WHERE type = 'ldap' AND status = 'active'").get() as any;
  const ssoCount = sqlite.prepare("SELECT COUNT(*) as c FROM auth_providers WHERE type IN ('keycloak','google','microsoft') AND status = 'active'").get() as any;
  if (ldapCount.c === 0) {
    sqlite.prepare("UPDATE settings SET value = 'false' WHERE key = 'auth_ldap_enabled' AND value = 'true'").run();
  }
  if (ssoCount.c === 0) {
    sqlite.prepare("UPDATE settings SET value = 'false' WHERE key = 'auth_sso_enabled' AND value = 'true'").run();
  }

  // Seed default auth provider if empty
  const provCount = sqlite.prepare('SELECT COUNT(*) as c FROM auth_providers').get() as any;
  if (provCount.c === 0) {
    sqlite.prepare("INSERT INTO auth_providers (name, type, config, status, priority) VALUES (?, ?, ?, ?, ?)").run('Local Auth', 'local', '{}', 'active', 0);
  }

  // No seed apps — super admin adds apps via Settings > Apps > + ADD APP
}
