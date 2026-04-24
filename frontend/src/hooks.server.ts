import type { Handle } from '@sveltejs/kit';
import { getUserFromCookies } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const user = await getUserFromCookies(event.cookies);
  event.locals.user = user;
  return resolve(event);
};
