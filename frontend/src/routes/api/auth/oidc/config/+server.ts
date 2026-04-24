import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authProviders } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
  const kcProviders = db.select().from(authProviders)
    .where(and(eq(authProviders.type, 'keycloak'), eq(authProviders.status, 'active')))
    .all();

  const providers: { id: number; name: string; realm: string }[] = kcProviders.map(p => {
    let config: any = {};
    try { config = JSON.parse(p.config || '{}'); } catch {}
    return { id: p.id, name: p.name, realm: config.realm || 'master' };
  });

  // Also check env vars as fallback
  if (providers.length === 0 && process.env.KEYCLOAK_URL && process.env.KEYCLOAK_CLIENT_ID) {
    providers.push({ id: 0, name: 'SSO', realm: process.env.KEYCLOAK_REALM || 'master' });
  }

  return json({ enabled: providers.length > 0, providers });
};
