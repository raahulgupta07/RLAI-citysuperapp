import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserFromCookies } from '$lib/server/auth';

export const GET: RequestHandler = async ({ cookies }) => {
  const user = await getUserFromCookies(cookies);
  if (!user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }
  return json({ user });
};
