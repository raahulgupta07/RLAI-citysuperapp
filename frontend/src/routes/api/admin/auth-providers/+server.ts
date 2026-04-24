import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authProviders } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const providers = db.select().from(authProviders).orderBy(authProviders.priority).all();
  // Parse config JSON and mask secrets
  const safe = providers.map(p => {
    let config: any = {};
    try { config = JSON.parse(p.config || '{}'); } catch {}
    // Mask secrets
    if (config.client_secret) config.client_secret = '••••••••';
    if (config.app_dn_password) config.app_dn_password = '••••••••';
    return { ...p, config };
  });
  return json({ providers: safe });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json();
  const { name, type, config, status, priority } = body;
  if (!name || !type) return json({ error: 'Name and type required' }, { status: 400 });

  const maxPriority = db.select({ max: authProviders.priority }).from(authProviders).get();
  const result = db.insert(authProviders).values({
    name,
    type,
    config: JSON.stringify(config || {}),
    status: status || 'active',
    priority: priority ?? ((maxPriority?.max || 0) + 1),
  }).returning().get();
  return json({ provider: result });
};
