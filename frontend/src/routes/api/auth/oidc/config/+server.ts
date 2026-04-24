import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authProviders, settings } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
  // Get auth method toggles
  const getToggle = (key: string) => {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value !== 'false';
  };

  const authMethods = {
    local: getToggle('auth_local_enabled'),
    ldap: getToggle('auth_ldap_enabled'),
    sso: getToggle('auth_sso_enabled'),
  };

  // Get active SSO providers (keycloak, google, microsoft)
  const ssoTypes = ['keycloak', 'google', 'microsoft'];
  const allProviders = db.select().from(authProviders)
    .where(eq(authProviders.status, 'active'))
    .all();

  const ssoProviders = allProviders
    .filter(p => ssoTypes.includes(p.type))
    .map(p => {
      let config: any = {};
      try { config = JSON.parse(p.config || '{}'); } catch {}
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        realm: config.realm || '',
      };
    });

  // Check if any LDAP providers are active
  const hasLdap = allProviders.some(p => p.type === 'ldap');

  // SSO is enabled if toggle is on AND at least one SSO provider exists
  const ssoEnabled = authMethods.sso && ssoProviders.length > 0;

  // Also check env vars as fallback for keycloak
  if (authMethods.sso && ssoProviders.length === 0 && process.env.KEYCLOAK_URL && process.env.KEYCLOAK_CLIENT_ID) {
    ssoProviders.push({ id: 0, name: 'SSO', type: 'keycloak', realm: process.env.KEYCLOAK_REALM || 'master' });
  }

  return json({
    authMethods,
    enabled: ssoProviders.length > 0 && authMethods.sso,
    providers: ssoProviders,
    hasLdap,
  });
};
