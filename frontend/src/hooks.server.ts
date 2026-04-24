import type { Handle } from '@sveltejs/kit';
import { getUserFromCookies, IS_PRODUCTION } from '$lib/server/auth';
import { isTokenBlacklisted } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
  const user = await getUserFromCookies(event.cookies);

  // Check if token has been invalidated (logout)
  if (user) {
    const token = event.cookies.get('superapp_token');
    if (token && isTokenBlacklisted(token)) {
      event.locals.user = null;
      event.cookies.delete('superapp_token', { path: '/' });
    } else {
      event.locals.user = user;
    }
  } else {
    event.locals.user = null;
  }

  const response = await resolve(event);

  // Security headers
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (IS_PRODUCTION) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // CSP: allow self, inline styles (Svelte needs them), and external fonts
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-src *; connect-src 'self';"
  );

  return response;
};
