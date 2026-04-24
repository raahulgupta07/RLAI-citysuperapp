import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, ssoUsers, authProviders } from '$lib/server/schema';
import { signJwt, setAuthCookie } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';

// OIDC endpoint config per provider type
function getOidcEndpoints(type: string, config: any) {
  switch (type) {
    case 'keycloak': {
      const base = `${config.url}/realms/${config.realm || 'master'}/protocol/openid-connect`;
      return { token: `${base}/token`, userinfo: `${base}/userinfo` };
    }
    case 'google':
      return {
        token: 'https://oauth2.googleapis.com/token',
        userinfo: 'https://www.googleapis.com/oauth2/v3/userinfo',
      };
    case 'microsoft': {
      const tenant = config.tenant_id || 'common';
      return {
        token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        userinfo: 'https://graph.microsoft.com/oidc/userinfo',
      };
    }
    default:
      return null;
  }
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) throw redirect(302, `/login?error=${encodeURIComponent(error)}`);
  if (!code) throw redirect(302, '/login?error=no_code');

  // Read and validate OIDC session cookie
  const sessionCookie = cookies.get('oidc_session');
  if (!sessionCookie) throw redirect(302, '/login?error=session_expired');

  let oidcSession: { state: string; code_verifier: string; provider_id: string; provider_type: string };
  try {
    oidcSession = JSON.parse(sessionCookie);
  } catch {
    throw redirect(302, '/login?error=invalid_session');
  }

  // Clear the session cookie immediately
  cookies.delete('oidc_session', { path: '/' });

  // Validate CSRF state
  if (!returnedState || returnedState !== oidcSession.state) {
    throw redirect(302, '/login?error=state_mismatch');
  }

  // Resolve provider config from DB or env
  let config: any = {};
  let providerType = oidcSession.provider_type || 'keycloak';
  let providerName = providerType.charAt(0).toUpperCase() + providerType.slice(1);
  let clientId = '';
  let clientSecret = '';

  const providerId = oidcSession.provider_id;
  if (providerId && providerId !== '0') {
    const provider = db.select().from(authProviders).where(eq(authProviders.id, parseInt(providerId))).get();
    if (provider) {
      try { config = JSON.parse(provider.config || '{}'); } catch {}
      providerType = provider.type;
      providerName = provider.name;
      clientId = config.client_id || '';
      clientSecret = config.client_secret || '';
    }
  }

  // Fallback to env vars (keycloak only)
  if (!clientId && providerType === 'keycloak') {
    config = {
      url: process.env.KEYCLOAK_URL,
      realm: process.env.KEYCLOAK_REALM || 'master',
    };
    clientId = process.env.KEYCLOAK_CLIENT_ID || '';
    clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
  }

  if (!clientId) {
    throw redirect(302, '/login?error=sso_not_configured');
  }

  const endpoints = getOidcEndpoints(providerType, config);
  if (!endpoints) {
    throw redirect(302, '/login?error=unknown_provider');
  }

  const redirectUri = `${url.origin}/api/auth/oidc/callback`;

  try {
    // Exchange code for token (with PKCE)
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: oidcSession.code_verifier,
    };
    if (clientSecret) {
      tokenParams.client_secret = clientSecret;
    }

    const tokenRes = await fetch(endpoints.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenRes.ok) throw redirect(302, '/login?error=token_exchange_failed');

    const tokenData = await tokenRes.json();

    // Get user info
    const userInfoRes = await fetch(endpoints.userinfo, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) throw redirect(302, '/login?error=userinfo_failed');

    const userInfo = await userInfoRes.json();

    // Normalize user claims across providers
    let username = '';
    let display_name = '';
    let email = '';
    let groups: string[] = [];

    if (providerType === 'google') {
      username = userInfo.email || userInfo.sub;
      display_name = userInfo.name || username;
      email = userInfo.email || '';
      groups = ['all'];
    } else if (providerType === 'microsoft') {
      username = userInfo.preferred_username || userInfo.email || userInfo.sub;
      display_name = userInfo.name || username;
      email = userInfo.email || userInfo.preferred_username || '';
      groups = ['all'];
    } else {
      // keycloak
      username = userInfo.preferred_username || userInfo.sub;
      display_name = userInfo.name || username;
      email = userInfo.email || '';
      groups = userInfo.groups || ['all'];
    }

    const auth_source = `sso:${providerName}`;

    // Upsert user
    let user = db.select().from(users).where(eq(users.username, username)).get();
    if (!user) {
      user = db.insert(users).values({
        username,
        display_name,
        email,
        role: 'user',
        auth_source,
        ldap_groups: JSON.stringify(groups),
        last_login: new Date().toISOString(),
      }).returning().get();
    } else {
      db.update(users).set({
        display_name,
        email,
        auth_source,
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

    logActivity({
      user_id: user.id,
      action: 'login',
      detail: `Auth method: SSO (${providerName})`,
    });

    // Upsert sso_users
    const existingSso = db.select().from(ssoUsers).where(eq(ssoUsers.user_id, user.id)).get();
    if (!existingSso) {
      db.insert(ssoUsers).values({
        user_id: user.id,
        provider: providerType,
        provider_user_id: userInfo.sub || '',
        provider_email: email,
        provider_data: JSON.stringify(userInfo),
      }).run();
    } else {
      db.update(ssoUsers).set({
        provider: providerType,
        provider_email: email,
        provider_data: JSON.stringify(userInfo),
        updated_at: new Date().toISOString(),
      }).where(eq(ssoUsers.user_id, user.id)).run();
    }

    throw redirect(302, '/home');
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e) throw e;
    throw redirect(302, '/login?error=sso_failed');
  }
};
