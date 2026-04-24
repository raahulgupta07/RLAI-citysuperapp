import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const { role } = await request.json();
  if (!['super_admin', 'admin', 'user', 'viewer'].includes(role)) return json({ error: 'Invalid role' }, { status: 400 });
  const userId = parseInt(params.id);
  db.update(users).set({ role }).where(eq(users.id, userId)).run();
  logActivity({ user_id: locals.user.id, action: 'admin_role_change', detail: `Changed user #${userId} role to ${role}` });
  return json({ ok: true });
};
