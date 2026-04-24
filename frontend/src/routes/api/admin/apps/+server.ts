import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { apps, appRoles } from '$lib/server/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug, url, description, category_id, launch_mode, icon, card_color, status, roles } = body;

  if (!name || !url) return json({ error: 'Name and URL required' }, { status: 400 });

  const maxOrder = db.select({ max: apps.sort_order }).from(apps).get();
  const nextOrder = (maxOrder?.max || 0) + 1;

  const result = db.insert(apps).values({
    name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    url, description: description || '', category_id, launch_mode: launch_mode || 'redirect',
    icon: icon || '', card_color: card_color || '#007518', status: status || 'active',
    sort_order: nextOrder, created_by: locals.user.id,
  }).returning().get();

  // Insert roles
  const groups = roles && roles.length > 0 ? roles : ['all'];
  for (const group of groups) {
    db.insert(appRoles).values({ app_id: result.id, ldap_group: group }).run();
  }

  return json({ app: result });
};
