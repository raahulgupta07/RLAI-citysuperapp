import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authProviders } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
  const providers = db.select({
    id: authProviders.id,
    name: authProviders.name,
    type: authProviders.type,
    priority: authProviders.priority,
  }).from(authProviders)
    .where(eq(authProviders.status, 'active'))
    .orderBy(authProviders.priority)
    .all();
  return json({ providers });
};
