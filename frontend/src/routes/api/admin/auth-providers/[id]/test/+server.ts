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
      const protocol = config.tls ? 'ldaps' : 'ldap';
      const port = config.port || (config.tls ? '636' : '389');
      const ldapUrl = `${protocol}://${config.host}:${port}`;
      const clientOpts: any = { url: ldapUrl, connectTimeout: 5000 };
      if (config.tls) {
        clientOpts.tlsOptions = { rejectUnauthorized: false };
      }
      const client = ldap.createClient(clientOpts);
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          try { client.unbind(); } catch {}
          resolve(json({ success: false, message: 'Connection timeout' }));
        }, 5000);

        client.on('connect', () => {
          clearTimeout(timeout);
          // If Application DN is configured, test the bind
          if (config.app_dn && config.app_dn_password) {
            client.bind(config.app_dn, config.app_dn_password, (bindErr: any) => {
              try { client.unbind(); } catch {}
              if (bindErr) {
                resolve(json({ success: false, message: `Connected but Application DN bind failed: ${bindErr.message}` }));
              } else {
                resolve(json({ success: true, message: `LDAP connection and Application DN bind successful (${ldapUrl})` }));
              }
            });
          } else {
            client.unbind();
            resolve(json({ success: true, message: `LDAP connection successful (${ldapUrl})` }));
          }
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
  } else if (provider.type === 'google') {
    try {
      const res = await fetch('https://accounts.google.com/.well-known/openid-configuration', { signal: AbortSignal.timeout(5000) });
      if (res.ok && config.client_id) {
        return json({ success: true, message: `Google OIDC reachable, Client ID configured: ${config.client_id.substring(0, 12)}...` });
      }
      return json({ success: false, message: config.client_id ? `Google returned ${res.status}` : 'Client ID not set' });
    } catch (e: any) {
      return json({ success: false, message: e.message || 'Cannot reach Google' });
    }
  } else if (provider.type === 'microsoft') {
    try {
      const tenant = config.tenant_id || 'common';
      const url = `https://login.microsoftonline.com/${tenant}/v2.0/.well-known/openid-configuration`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok && config.client_id) {
        return json({ success: true, message: `Microsoft OIDC reachable (tenant: ${tenant}), Client ID configured` });
      }
      return json({ success: false, message: config.client_id ? `Microsoft returned ${res.status}` : 'Client ID not set' });
    } catch (e: any) {
      return json({ success: false, message: e.message || 'Cannot reach Microsoft' });
    }
  }

  return json({ success: true, message: 'Local auth always works' });
};
