import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { categories } from '$lib/server/schema';
import { logActivity } from '$lib/server/activity';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const { name } = await request.json();
  if (!name) return json({ error: 'Name required' }, { status: 400 });
  const maxOrder = db.select({ max: categories.sort_order }).from(categories).get();
  const result = db.insert(categories).values({ name, sort_order: (maxOrder?.max || 0) + 1 }).returning().get();
  logActivity({ user_id: locals.user.id, action: 'admin_category_create', detail: `Created category "${name}" (id=${result.id})` });
  return json({ category: result });
};
