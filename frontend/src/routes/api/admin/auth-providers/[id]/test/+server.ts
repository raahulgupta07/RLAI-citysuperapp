import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authProviders } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt(params.id);
  const provider = db.select().from(authProviders).where(eq(authProviders.id, id)).get();
  if (!provider) return json({ error: 'Not found' }, { status: 404 });

  let config: any = {};
  try { config = JSON.parse(provider.config || '{}'); } catch {}

  if (provider.type === 'ldap') {
    try {
      const ldap = await import('ldapjs');
      const client = ldap.createClient({ url: config.url, connectTimeout: 5000 });
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          try { client.unbind(); } catch {}
          resolve(json({ success: false, message: 'Connection timeout' }));
        }, 5000);

        client.on('connect', () => {
          clearTimeout(timeout);
          client.unbind();
          resolve(json({ success: true, message: 'LDAP connection successful' }));
        });
        client.on('error', (err: any) => {
          clearTimeout(timeout);
          resolve(json({ success: false, message: `LDAP error: ${err.message}` }));
        });
      });
    } catch (e: any) {
      return json({ success: false, message: e.message || 'LDAP module not available' });
    }
  } else if (provider.type === 'keycloak') {
    try {
      const url = `${config.url}/realms/${config.realm || 'master'}/.well-known/openid-configuration`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        return json({ success: true, message: 'Keycloak reachable, OIDC config found' });
      }
      return json({ success: false, message: `Keycloak returned ${res.status}` });
    } catch (e: any) {
      return json({ success: false, message: e.message || 'Cannot reach Keycloak' });
    }
  }

  return json({ success: true, message: 'Local auth always works' });
};
