import type { Handle } from '@sveltejs/kit';
import { sessionUser } from '../server/store.mjs';
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = sessionUser(event.cookies.get('excalihub_session'));
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  if (
    event.url.pathname.startsWith('/api/') ||
    event.url.pathname.startsWith('/diagrams') ||
    event.url.pathname === '/'
  )
    response.headers.set('Cache-Control', 'no-store');
  return response;
};
