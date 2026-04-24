import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

const AUTH_KEYS = ['auth_local_enabled', 'auth_ldap_enabled', 'auth_sso_enabled'] as const;

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });

  const result: Record<string, boolean> = {};
  for (const key of AUTH_KEYS) {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    result[key] = row?.value !== 'false'; // default to true
  }
  return json(result);
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  for (const key of AUTH_KEYS) {
    if (key in body) {
      const value = body[key] ? 'true' : 'false';
      const existing = db.select().from(settings).where(eq(settings.key, key)).get();
      if (existing) {
        db.update(settings).set({ value }).where(eq(settings.key, key)).run();
      } else {
        db.insert(settings).values({ key, value }).run();
      }
    }
  }
  return json({ success: true });
};
