import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, validatePassword } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const { username, display_name, email, password, role } = await request.json();

  if (!username || !password) {
    return json({ error: 'Username and password required' }, { status: 400 });
  }

  const passError = validatePassword(password);
  if (passError) {
    return json({ error: passError }, { status: 400 });
  }

  // Check if username already exists
  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing) {
    return json({ error: 'Username already exists' }, { status: 409 });
  }

  const validRoles = ['super_admin', 'admin', 'user', 'viewer'];
  const userRole = validRoles.includes(role) ? role : 'user';

  const result = db.insert(users).values({
    username,
    display_name: display_name || username,
    email: email || '',
    password_hash: await hashPassword(password),
    role: userRole,
    auth_source: 'local',
    status: 'active',
    ldap_groups: JSON.stringify(['all']),
  }).returning().get();

  logActivity({ user_id: locals.user.id, action: 'admin_user_create', detail: `Created user: ${username} (role: ${userRole})` });
  return json({ user: { id: result.id, username: result.username } });
};
