import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, authProviders } from '$lib/server/schema';
import { signJwt, setAuthCookie, authenticateLdap, type LdapConfig, checkLocalPassword, hashPassword, isPasswordHashed } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';
import { checkRateLimit } from '$lib/server/ratelimit';

const SUPER_ADMIN_USER = process.env.SUPER_ADMIN_USER || 'admin';
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASS || 'admin';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json();
  const { username, password, authMethod, register, rememberMe } = body;

  if (!username || !password) {
    return json({ error: 'Username and password required' }, { status: 400 });
  }

  // Rate limiting: 5 attempts per username, 20 per IP, 15-minute window
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const userLimit = checkRateLimit(`user:${username}`, 5, 15 * 60 * 1000);
  const ipLimit = checkRateLimit(`ip:${ip}`, 20, 15 * 60 * 1000);
  if (!userLimit.allowed) {
    return json({ error: `Too many login attempts. Try again in ${userLimit.retryAfterSec}s` }, { status: 429 });
  }
  if (!ipLimit.allowed) {
    return json({ error: `Too many login attempts from this IP. Try again in ${ipLimit.retryAfterSec}s` }, { status: 429 });
  }

  // Self-registration disabled — only admins can create users via Settings > USERS
  if (register) {
    return json({ error: 'Registration disabled. Contact your administrator.' }, { status: 403 });
  }

  let ldap_groups: string[] = ['all'];
  let display_name = username;
  let email = '';
  let role = 'user';
  let authenticated = false;
  let auth_source = 'local';

  // Get active LDAP providers from DB
  const ldapProviders = db.select().from(authProviders)
    .where(and(eq(authProviders.type, 'ldap'), eq(authProviders.status, 'active')))
    .orderBy(authProviders.priority).all();

  if (authMethod === 'ldap') {
    // Try each active LDAP provider in priority order
    for (const provider of ldapProviders) {
      let config: any = {};
      try { config = JSON.parse(provider.config || '{}'); } catch {}
      if (!config.host) continue;

      const ldapConfig: LdapConfig = {
        host: config.host,
        port: config.port,
        app_dn: config.app_dn,
        app_dn_password: config.app_dn_password,
        mail_attr: config.mail_attr,
        username_attr: config.username_attr,
        search_base: config.search_base,
        search_filter: config.search_filter,
        group_attr: config.group_attr,
        tls: config.tls,
      };

      const ldapResult = await authenticateLdap(username, password, ldapConfig);
      if (ldapResult.success) {
        authenticated = true;
        ldap_groups = ldapResult.groups;
        display_name = ldapResult.display_name || username;
        email = ldapResult.email;
        auth_source = `ldap:${provider.name}`;
        break;
      }
    }
    // Also fall back to env-based LDAP if no DB providers matched
    if (!authenticated && process.env.LDAP_URL) {
      const envHost = process.env.LDAP_URL.replace(/^ldaps?:\/\//, '').replace(/:\d+$/, '');
      const ldapResult = await authenticateLdap(username, password, { host: envHost });
      if (ldapResult.success) {
        authenticated = true;
        ldap_groups = ldapResult.groups;
        display_name = ldapResult.display_name || username;
        email = ldapResult.email;
        auth_source = 'ldap';
      }
    }
    // Also allow super admin via LDAP tab as fallback
    if (!authenticated && username === SUPER_ADMIN_USER && password === SUPER_ADMIN_PASS) {
      authenticated = true;
      role = 'super_admin';
      display_name = 'Super Admin';
      ldap_groups = ['all', 'admin'];
      auth_source = 'local';
    }
    if (!authenticated) {
      return json({ error: 'LDAP authentication failed' }, { status: 401 });
    }
  } else if (authMethod === 'local') {
    // Local only: check super admin creds
    if (username === SUPER_ADMIN_USER && password === SUPER_ADMIN_PASS) {
      authenticated = true;
      role = 'super_admin';
      display_name = 'Super Admin';
      ldap_groups = ['all', 'admin'];
    }
    // Check DB user with password (bcrypt)
    if (!authenticated) {
      const dbUser = db.select().from(users).where(eq(users.username, username)).get();
      if (dbUser && (dbUser as any).password_hash) {
        const passMatch = await checkLocalPassword(password, (dbUser as any).password_hash);
        if (passMatch) {
          authenticated = true;
          display_name = dbUser.display_name || username;
          email = dbUser.email || '';
          role = dbUser.role || 'user';
          try {
            ldap_groups = JSON.parse(dbUser.ldap_groups || '["all"]');
          } catch {
            ldap_groups = ['all'];
          }
          // Migrate plain text password to bcrypt on successful login
          if (!isPasswordHashed((dbUser as any).password_hash)) {
            const hashed = await hashPassword(password);
            db.update(users).set({ password_hash: hashed } as any).where(eq(users.id, dbUser.id)).run();
          }
        }
      }
    }
    if (!authenticated) {
      return json({ error: 'Invalid credentials' }, { status: 401 });
    }
  } else {
    // Default: try LDAP providers first, then fallback to local
    for (const provider of ldapProviders) {
      let config: any = {};
      try { config = JSON.parse(provider.config || '{}'); } catch {}
      if (!config.host) continue;
      const ldapResult = await authenticateLdap(username, password, {
        host: config.host, port: config.port, app_dn: config.app_dn,
        app_dn_password: config.app_dn_password, mail_attr: config.mail_attr,
        username_attr: config.username_attr, search_base: config.search_base,
        search_filter: config.search_filter, group_attr: config.group_attr, tls: config.tls,
      });
      if (ldapResult.success) {
        authenticated = true;
        ldap_groups = ldapResult.groups;
        display_name = ldapResult.display_name || username;
        email = ldapResult.email;
        break;
      }
    }

    if (!authenticated && username === SUPER_ADMIN_USER && password === SUPER_ADMIN_PASS) {
      authenticated = true;
      role = 'super_admin';
      display_name = 'Super Admin';
      ldap_groups = ['all', 'admin'];
    }

    if (!authenticated) {
      const dbUser = db.select().from(users).where(eq(users.username, username)).get();
      if (dbUser && (dbUser as any).password_hash) {
        const passMatch = await checkLocalPassword(password, (dbUser as any).password_hash);
        if (passMatch) {
          authenticated = true;
          display_name = dbUser.display_name || username;
          email = dbUser.email || '';
          role = dbUser.role || 'user';
          try {
            ldap_groups = JSON.parse(dbUser.ldap_groups || '["all"]');
          } catch {
            ldap_groups = ['all'];
          }
          if (!isPasswordHashed((dbUser as any).password_hash)) {
            const hashed = await hashPassword(password);
            db.update(users).set({ password_hash: hashed } as any).where(eq(users.id, dbUser.id)).run();
          }
        }
      }
    }

    if (!authenticated) {
      return json({ error: 'Invalid credentials' }, { status: 401 });
    }
  }

  // Determine auth_source (already set above for ldap, default for others)
  if (authMethod !== 'ldap') {
    auth_source = authMethod === 'local' ? 'local' : 'local';
  }

  // Upsert user in DB
  let user = db.select().from(users).where(eq(users.username, username)).get();

  if (!user) {
    const result = db.insert(users).values({
      username,
      display_name,
      email,
      role,
      auth_source,
      ldap_groups: JSON.stringify(ldap_groups),
      last_login: new Date().toISOString(),
    }).returning().get();
    user = result;
  } else {
    db.update(users).set({
      display_name,
      email,
      auth_source,
      ldap_groups: JSON.stringify(ldap_groups),
      last_login: new Date().toISOString(),
    }).where(eq(users.id, user.id)).run();
    // Keep existing role if already set
    if (user.role === 'super_admin') role = 'super_admin';
    else role = user.role || role;
  }

  // Sign JWT
  const token = await signJwt({
    id: user.id,
    username: user.username,
    display_name,
    email,
    role,
    ldap_groups,
  }, !!rememberMe);

  setAuthCookie(cookies, token, !!rememberMe);

  logActivity({
    user_id: user.id,
    action: 'login',
    detail: `Auth method: ${authMethod || 'default'}`,
    ip_address: request.headers.get('x-forwarded-for') || '',
    user_agent: request.headers.get('user-agent') || '',
  });

  return json({
    user: {
      id: user.id,
      username: user.username,
      display_name,
      role,
    },
  });
};
