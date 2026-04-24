import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authProviders } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt(params.id);
  const body = await request.json();

  // If config has masked secret, don't overwrite it
  let configToSave = body.config;
  if (configToSave && typeof configToSave === 'object') {
    if (configToSave.client_secret === '••••••••') {
      // Keep existing secret
      const existing = db.select().from(authProviders).where(eq(authProviders.id, id)).get();
      if (existing) {
        try {
          const existingConfig = JSON.parse(existing.config || '{}');
          configToSave.client_secret = existingConfig.client_secret;
        } catch {}
      }
    }
    configToSave = JSON.stringify(configToSave);
  }

  db.update(authProviders).set({
    name: body.name,
    type: body.type,
    config: configToSave,
    status: body.status || 'active',
    priority: body.priority ?? 0,
    updated_at: new Date().toISOString(),
  }).where(eq(authProviders.id, id)).run();
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt(params.id);
  // Don't allow deleting the local provider
  const provider = db.select().from(authProviders).where(eq(authProviders.id, id)).get();
  if (provider?.type === 'local') return json({ error: 'Cannot delete local auth' }, { status: 400 });
  db.delete(authProviders).where(eq(authProviders.id, id)).run();
  return json({ ok: true });
};
