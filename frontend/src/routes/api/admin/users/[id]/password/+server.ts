import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, validatePassword } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const { password } = await request.json();
  if (!password) return json({ error: 'Password required' }, { status: 400 });
  const passError = validatePassword(password);
  if (passError) return json({ error: passError }, { status: 400 });
  const hashed = await hashPassword(password);
  const userId = parseInt(params.id);
  db.update(users).set({ password_hash: hashed }).where(eq(users.id, userId)).run();
  logActivity({ user_id: locals.user.id, action: 'admin_password_reset', detail: `Reset password for user #${userId}` });
  return json({ ok: true });
};
