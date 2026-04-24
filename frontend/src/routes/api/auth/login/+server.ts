import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, authProviders } from '$lib/server/schema';
import { signJwt, setAuthCookie, authenticateLdap } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';

const SUPER_ADMIN_USER = process.env.SUPER_ADMIN_USER || 'admin';
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASS || 'admin';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json();
  const { username, password, authMethod, register } = body;

  if (!username || !password) {
    return json({ error: 'Username and password required' }, { status: 400 });
  }

  // Registration mode (local only)
  if (register && authMethod === 'local') {
    const existing = db.select().from(users).where(eq(users.username, username)).get();
    if (existing) {
      return json({ error: 'Username already exists' }, { status: 409 });
    }
    const newUser = db.insert(users).values({
      username,
      display_name: username,
      email: '',
      role: 'user',
      password_hash: password, // dev mode: storing as-is
      ldap_groups: JSON.stringify(['all']),
      last_login: new Date().toISOString(),
    }).returning().get();

    const token = await signJwt({
      id: newUser.id,
      username: newUser.username,
      display_name: username,
      email: '',
      role: 'user',
      ldap_groups: ['all'],
    });
    setAuthCookie(cookies, token);
    return json({ user: { id: newUser.id, username, display_name: username, role: 'user' } });
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
      if (!config.url) continue;

      const ldapResult = await authenticateLdap(username, password, config.url, config.bind_dn, config.search_base);
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
    if (!authenticated) {
      const ldapResult = await authenticateLdap(username, password);
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
    // Check DB user with password
    if (!authenticated) {
      const dbUser = db.select().from(users).where(eq(users.username, username)).get();
      if (dbUser && (dbUser as any).password_hash === password) {
        authenticated = true;
        display_name = dbUser.display_name || username;
        email = dbUser.email || '';
        role = dbUser.role || 'user';
        try {
          ldap_groups = JSON.parse(dbUser.ldap_groups || '["all"]');
        } catch {
          ldap_groups = ['all'];
        }
      }
    }
    if (!authenticated) {
      return json({ error: 'Invalid credentials' }, { status: 401 });
    }
  } else {
    // Default: try LDAP first, then fallback to local
    const ldapResult = await authenticateLdap(username, password);
    if (ldapResult.success) {
      authenticated = true;
      ldap_groups = ldapResult.groups;
      display_name = ldapResult.display_name || username;
      email = ldapResult.email;
    }

    if (!authenticated && username === SUPER_ADMIN_USER && password === SUPER_ADMIN_PASS) {
      authenticated = true;
      role = 'super_admin';
      display_name = 'Super Admin';
      ldap_groups = ['all', 'admin'];
    }

    if (!authenticated) {
      const dbUser = db.select().from(users).where(eq(users.username, username)).get();
      if (dbUser && (dbUser as any).password_hash === password) {
        authenticated = true;
        display_name = dbUser.display_name || username;
        email = dbUser.email || '';
        role = dbUser.role || 'user';
        try {
          ldap_groups = JSON.parse(dbUser.ldap_groups || '["all"]');
        } catch {
          ldap_groups = ['all'];
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
  });

  setAuthCookie(cookies, token);

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
