import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const isLoginPage = url.pathname === '/login';
  const isApiRoute = url.pathname.startsWith('/api');

  if (!locals.user && !isLoginPage && !isApiRoute) {
    throw redirect(302, '/login');
  }

  return {
    user: locals.user,
  };
};
