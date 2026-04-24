import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '$lib/server/auth';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const { password } = await request.json();
  if (!password || password.length < 4) return json({ error: 'Password too short' }, { status: 400 });
  const hashed = await hashPassword(password);
  db.update(users).set({ password_hash: hashed }).where(eq(users.id, parseInt(params.id))).run();
  return json({ ok: true });
};
