import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearAuthCookie, getUserFromCookies } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';

export const POST: RequestHandler = async ({ cookies }) => {
  const user = await getUserFromCookies(cookies);
  if (user) {
    logActivity({ user_id: user.id, action: 'logout' });
  }

  clearAuthCookie(cookies);
  return json({ ok: true });
};
