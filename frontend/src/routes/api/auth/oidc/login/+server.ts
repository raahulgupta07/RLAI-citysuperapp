import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authProviders } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { IS_PRODUCTION } from '$lib/server/auth';

// OIDC endpoint config per provider type
function getOidcEndpoints(type: string, config: any) {
  switch (type) {
    case 'keycloak': {
      const base = `${config.url}/realms/${config.realm || 'master'}/protocol/openid-connect`;
      return {
        auth: `${base}/auth`,
        token: `${base}/token`,
        userinfo: `${base}/userinfo`,
        scope: 'openid profile email',
      };
    }
    case 'google':
      return {
        auth: 'https://accounts.google.com/o/oauth2/v2/auth',
        token: 'https://oauth2.googleapis.com/token',
        userinfo: 'https://www.googleapis.com/oauth2/v3/userinfo',
        scope: 'openid profile email',
      };
    case 'microsoft': {
      const tenant = config.tenant_id || 'common';
      return {
        auth: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
        token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        userinfo: 'https://graph.microsoft.com/oidc/userinfo',
        scope: 'openid profile email User.Read',
      };
    }
    default:
      return null;
  }
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const providerId = url.searchParams.get('provider_id');

  let providerType = 'keycloak';
  let clientId = '';
  let config: any = {};
  let resolvedProviderId = providerId || '0';

  if (providerId && providerId !== '0') {
    const provider = db.select().from(authProviders).where(eq(authProviders.id, parseInt(providerId))).get();
    if (provider) {
      try { config = JSON.parse(provider.config || '{}'); } catch {}
      providerType = provider.type;
      clientId = config.client_id || '';
    }
  }

  // Fallback to env (keycloak only)
  if (!clientId && providerType === 'keycloak') {
    if (process.env.KEYCLOAK_URL && process.env.KEYCLOAK_CLIENT_ID) {
      config = {
        url: process.env.KEYCLOAK_URL,
        realm: process.env.KEYCLOAK_REALM || 'master',
        client_id: process.env.KEYCLOAK_CLIENT_ID,
      };
      clientId = config.client_id;
      resolvedProviderId = '0';
    }
  }

  if (!clientId) {
    return json({ error: 'SSO not configured' }, { status: 400 });
  }

  const endpoints = getOidcEndpoints(providerType, config);
  if (!endpoints) {
    return json({ error: 'Unknown SSO provider type' }, { status: 400 });
  }

  // Generate CSRF state
  const state = randomBytes(32).toString('hex');

  // Generate PKCE code_verifier and code_challenge
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  // Store session in HttpOnly cookie
  const oidcSession = JSON.stringify({
    state,
    code_verifier: codeVerifier,
    provider_id: resolvedProviderId,
    provider_type: providerType,
  });
  cookies.set('oidc_session', oidcSession, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: 600,
  });

  const redirectUri = `${url.origin}/api/auth/oidc/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: endpoints.scope,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Microsoft needs response_mode=query explicitly
  if (providerType === 'microsoft') {
    params.set('response_mode', 'query');
  }

  const authUrl = `${endpoints.auth}?${params.toString()}`;
  return json({ url: authUrl });
};
