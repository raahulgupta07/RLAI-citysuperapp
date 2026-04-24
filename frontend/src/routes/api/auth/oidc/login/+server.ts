import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authProviders } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
  const providerId = url.searchParams.get('provider_id');

  let KEYCLOAK_URL: string | undefined;
  let KEYCLOAK_REALM = 'master';
  let KEYCLOAK_CLIENT_ID = '';

  if (providerId && providerId !== '0') {
    const provider = db.select().from(authProviders).where(eq(authProviders.id, parseInt(providerId))).get();
    if (provider) {
      let config: any = {};
      try { config = JSON.parse(provider.config || '{}'); } catch {}
      KEYCLOAK_URL = config.url;
      KEYCLOAK_REALM = config.realm || 'master';
      KEYCLOAK_CLIENT_ID = config.client_id || '';
    }
  }

  // Fallback to env
  if (!KEYCLOAK_URL) {
    KEYCLOAK_URL = process.env.KEYCLOAK_URL;
    KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'master';
    KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || '';
  }

  if (!KEYCLOAK_URL || !KEYCLOAK_CLIENT_ID) {
    return json({ error: 'SSO not configured' }, { status: 400 });
  }

  const redirectUri = url.searchParams.get('redirect_uri') || `${url.origin}/api/auth/oidc/callback`;
  const authUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id=${KEYCLOAK_CLIENT_ID}&response_type=code&scope=openid profile email&redirect_uri=${encodeURIComponent(redirectUri)}`;
  return json({ url: authUrl });
};
