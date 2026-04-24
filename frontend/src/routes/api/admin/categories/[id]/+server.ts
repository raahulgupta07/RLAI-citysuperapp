import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { categories, apps } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const { name } = await request.json();
  db.update(categories).set({ name }).where(eq(categories.id, parseInt(params.id))).run();
  logActivity({ user_id: locals.user.id, action: 'admin_category_update', detail: `Updated category ${params.id}: name="${name}"` });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const categoryId = parseInt(params.id);
  const appsInCategory = db.select().from(apps).where(eq(apps.category_id, categoryId)).all();
  if (appsInCategory.length > 0) {
    return json({ error: 'Cannot delete category with apps assigned. Move or delete the apps first.' }, { status: 400 });
  }
  db.delete(categories).where(eq(categories.id, categoryId)).run();
  logActivity({ user_id: locals.user.id, action: 'admin_category_delete', detail: `Deleted category ${categoryId}` });
  return json({ ok: true });
};
