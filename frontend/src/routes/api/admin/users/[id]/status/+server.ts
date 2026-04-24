import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const { status } = await request.json();
  if (!['active', 'disabled'].includes(status)) return json({ error: 'Invalid status' }, { status: 400 });
  const userId = parseInt(params.id);
  db.update(users).set({ status }).where(eq(users.id, userId)).run();
  logActivity({ user_id: locals.user.id, action: 'admin_user_status', detail: `Set user #${userId} status to ${status}` });
  return json({ ok: true });
};
