import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { apps, appRoles } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);
  const body = await request.json();

  db.update(apps).set({
    name: body.name,
    slug: body.slug,
    url: body.url,
    description: body.description || '',
    category_id: body.category_id,
    launch_mode: body.launch_mode || 'redirect',
    icon: body.icon || '',
    card_color: body.card_color || '#007518',
    status: body.status || 'active',
    updated_at: new Date().toISOString(),
  }).where(eq(apps.id, id)).run();

  // Update roles
  db.delete(appRoles).where(eq(appRoles.app_id, id)).run();
  const groups = body.roles && body.roles.length > 0 ? body.roles : ['all'];
  for (const group of groups) {
    db.insert(appRoles).values({ app_id: id, ldap_group: group }).run();
  }

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);
  db.delete(appRoles).where(eq(appRoles.app_id, id)).run();
  db.delete(apps).where(eq(apps.id, id)).run();

  return json({ ok: true });
};
