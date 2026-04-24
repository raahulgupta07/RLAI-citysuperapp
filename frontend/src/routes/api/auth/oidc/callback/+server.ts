import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, ssoUsers } from '$lib/server/schema';
import { signJwt, setAuthCookie } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  if (!code) throw redirect(302, '/login?error=no_code');

  const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
  const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'master';
  const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || '';
  const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';
  const redirectUri = `${url.origin}/api/auth/oidc/callback`;

  try {
    // Exchange code for token
    const tokenRes = await fetch(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: KEYCLOAK_CLIENT_ID,
          client_secret: KEYCLOAK_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!tokenRes.ok) throw redirect(302, '/login?error=token_exchange_failed');

    const tokenData = await tokenRes.json();

    // Get user info
    const userInfoRes = await fetch(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    if (!userInfoRes.ok) throw redirect(302, '/login?error=userinfo_failed');

    const userInfo = await userInfoRes.json();
    const username = userInfo.preferred_username || userInfo.sub;
    const display_name = userInfo.name || username;
    const email = userInfo.email || '';
    const groups = userInfo.groups || ['all'];

    // Upsert user
    let user = db.select().from(users).where(eq(users.username, username)).get();
    if (!user) {
      user = db.insert(users).values({
        username,
        display_name,
        email,
        role: 'user',
        auth_source: 'sso',
        ldap_groups: JSON.stringify(groups),
        last_login: new Date().toISOString(),
      }).returning().get();
    } else {
      db.update(users).set({
        display_name,
        email,
        auth_source: 'sso',
        ldap_groups: JSON.stringify(groups),
        last_login: new Date().toISOString(),
      }).where(eq(users.id, user.id)).run();
    }

    // Sign JWT and set cookie
    const token = await signJwt({
      id: user.id,
      username,
      display_name,
      email,
      role: user.role || 'user',
      ldap_groups: groups,
    });
    setAuthCookie(cookies, token);

    logActivity({ user_id: user.id, action: 'login', detail: 'Auth method: SSO (Keycloak)' });

    // Upsert sso_users
    const existingSso = db.select().from(ssoUsers).where(eq(ssoUsers.user_id, user.id)).get();
    if (!existingSso) {
      db.insert(ssoUsers).values({
        user_id: user.id,
        provider: 'keycloak',
        provider_user_id: userInfo.sub || '',
        provider_email: email,
        provider_data: JSON.stringify(userInfo),
      }).run();
    } else {
      db.update(ssoUsers).set({
        provider_email: email,
        provider_data: JSON.stringify(userInfo),
        updated_at: new Date().toISOString(),
      }).where(eq(ssoUsers.user_id, user.id)).run();
    }

    throw redirect(302, '/home');
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e) throw e; // re-throw redirects
    throw redirect(302, '/login?error=sso_failed');
  }
};
