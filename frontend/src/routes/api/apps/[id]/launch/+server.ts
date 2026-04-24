import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { appUsage } from '$lib/server/schema';
import { logActivity } from '$lib/server/activity';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });

  db.insert(appUsage).values({
    user_id: locals.user.id,
    app_id: parseInt(params.id),
    action: 'launch',
  }).run();

  logActivity({
    user_id: locals.user.id,
    action: 'app_launch',
    detail: 'Launched app',
    app_id: parseInt(params.id),
  });

  return json({ ok: true });
};
