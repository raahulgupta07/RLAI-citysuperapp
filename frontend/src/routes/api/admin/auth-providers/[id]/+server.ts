import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authProviders } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt(params.id);
  const body = await request.json();

  // If config has masked secrets, preserve existing values
  let configToSave = body.config;
  if (configToSave && typeof configToSave === 'object') {
    const maskedFields = ['client_secret', 'app_dn_password'];
    const hasMasked = maskedFields.some(f => configToSave[f] === '••••••••');
    if (hasMasked) {
      const existing = db.select().from(authProviders).where(eq(authProviders.id, id)).get();
      if (existing) {
        try {
          const existingConfig = JSON.parse(existing.config || '{}');
          for (const field of maskedFields) {
            if (configToSave[field] === '••••••••') {
              configToSave[field] = existingConfig[field];
            }
          }
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
  logActivity({ user_id: locals.user.id, action: 'admin_provider_update', detail: `Updated provider #${id}: ${body.name}` });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt(params.id);
  const provider = db.select().from(authProviders).where(eq(authProviders.id, id)).get();
  if (provider?.type === 'local') return json({ error: 'Cannot delete local auth' }, { status: 400 });
  const provName = provider?.name || `#${id}`;
  db.delete(authProviders).where(eq(authProviders.id, id)).run();
  logActivity({ user_id: locals.user.id, action: 'admin_provider_delete', detail: `Deleted provider: ${provName}` });
  return json({ ok: true });
};
