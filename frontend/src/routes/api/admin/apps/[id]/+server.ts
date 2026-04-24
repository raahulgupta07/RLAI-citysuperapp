import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { apps, appRoles, appUsage, activityLog, favorites } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { sanitizeText, sanitizeUrl } from '$lib/server/sanitize';
import { logActivity } from '$lib/server/activity';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);
  const body = await request.json();

  db.update(apps).set({
    name: sanitizeText(body.name),
    slug: body.slug,
    url: sanitizeUrl(body.url),
    description: sanitizeText(body.description || ''),
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

  logActivity({ user_id: locals.user.id, action: 'admin_app_update', detail: `Updated app #${id}: ${sanitizeText(body.name)}`, app_id: id });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);

  // Get app name before deleting for audit log
  const app = db.select().from(apps).where(eq(apps.id, id)).get();
  const appName = app?.name || `#${id}`;

  // Delete all related records first (foreign key references)
  db.delete(appRoles).where(eq(appRoles.app_id, id)).run();
  db.delete(favorites).where(eq(favorites.app_id, id)).run();
  db.delete(appUsage).where(eq(appUsage.app_id, id)).run();
  db.delete(activityLog).where(eq(activityLog.app_id, id)).run();
  db.delete(apps).where(eq(apps.id, id)).run();

  logActivity({ user_id: locals.user.id, action: 'admin_app_delete', detail: `Deleted app: ${appName}` });
  return json({ ok: true });
};
