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
      type TEXT NOT NULL CHECK(type IN ('ldap','keycloak','local')),
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

  // Seed default auth provider if empty
  const provCount = sqlite.prepare('SELECT COUNT(*) as c FROM auth_providers').get() as any;
  if (provCount.c === 0) {
    sqlite.prepare("INSERT INTO auth_providers (name, type, config, status, priority) VALUES (?, ?, ?, ?, ?)").run('Local Auth', 'local', '{}', 'active', 0);
  }

  // No seed apps — super admin adds apps via Settings > Apps > + ADD APP
}
