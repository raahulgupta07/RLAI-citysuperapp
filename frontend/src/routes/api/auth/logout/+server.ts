import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearAuthCookie, getUserFromCookies } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { blacklistToken } from '$lib/server/session';

export const POST: RequestHandler = async ({ cookies }) => {
  const user = await getUserFromCookies(cookies);
  const token = cookies.get('superapp_token');

  if (user) {
    logActivity({ user_id: user.id, action: 'logout' });
  }

  // Blacklist the token so it can't be reused
  if (token) {
    blacklistToken(token);
  }

  clearAuthCookie(cookies);
  return json({ ok: true });
};
