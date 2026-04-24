import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  display_name: text('display_name').default(''),
  email: text('email').default(''),
  password_hash: text('password_hash').default(''),
  role: text('role', { enum: ['super_admin', 'admin', 'viewer', 'user'] }).default('user'),
  auth_source: text('auth_source').default('local'), // local, ldap, sso
  status: text('status').default('active'), // active, disabled
  ldap_groups: text('ldap_groups').default('[]'),
  last_login: text('last_login'),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sort_order: integer('sort_order').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export const apps = sqliteTable('apps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').default(''),
  category_id: integer('category_id').references(() => categories.id),
  url: text('url').notNull(),
  icon: text('icon').default(''),
  card_color: text('card_color').default('#007518'),
  launch_mode: text('launch_mode', { enum: ['redirect', 'embed'] }).default('redirect'),
  status: text('status', { enum: ['active', 'draft', 'disabled'] }).default('active'),
  sort_order: integer('sort_order').default(0),
  created_by: integer('created_by').references(() => users.id),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
});

export const appRoles = sqliteTable('app_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  app_id: integer('app_id').references(() => apps.id, { onDelete: 'cascade' }),
  ldap_group: text('ldap_group').notNull(),
});

export const favorites = sqliteTable('favorites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  app_id: integer('app_id').references(() => apps.id, { onDelete: 'cascade' }),
});

export const appUsage = sqliteTable('app_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id),
  app_id: integer('app_id').references(() => apps.id),
  action: text('action').default('launch'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').default(''),
});

export const activityLog = sqliteTable('activity_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id),
  action: text('action').notNull(), // login, logout, app_launch, app_embed, page_view
  detail: text('detail').default(''), // e.g. app name, page path
  app_id: integer('app_id').references(() => apps.id),
  ip_address: text('ip_address').default(''),
  user_agent: text('user_agent').default(''),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export const authProviders = sqliteTable('auth_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['ldap', 'keycloak', 'google', 'microsoft', 'local'] }).notNull(),
  config: text('config').default('{}'), // JSON: url, bind_dn, search_base, realm, client_id, etc
  status: text('status').default('active'), // active, disabled
  priority: integer('priority').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
});

export const ssoUsers = sqliteTable('sso_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').default('keycloak'), // keycloak, ldap, local
  provider_user_id: text('provider_user_id').default(''),
  provider_email: text('provider_email').default(''),
  provider_data: text('provider_data').default('{}'), // JSON blob of extra provider info
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
});
