import type { RequestHandler } from './$types';
import {
  checkOrigin,
  failure,
  response,
  sessionCookie,
} from '$lib/server/http';
import { logout } from '../../../../../server/store.mjs';
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    checkOrigin(request);
    logout(cookies.get(sessionCookie));
    cookies.delete(sessionCookie, { path: '/' });
    return response({ ok: true });
  } catch (error) {
    return failure(error);
  }
};
