import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { favorites } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });

  const appId = parseInt(params.id);
  const userId = locals.user.id;

  // Check if already favorited
  const existing = db.select().from(favorites)
    .where(and(eq(favorites.user_id, userId), eq(favorites.app_id, appId)))
    .get();

  if (existing) {
    db.delete(favorites).where(eq(favorites.id, existing.id)).run();
    return json({ favorited: false });
  } else {
    db.insert(favorites).values({ user_id: userId, app_id: appId }).run();
    return json({ favorited: true });
  }
};
