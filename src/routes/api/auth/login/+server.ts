import type { RequestHandler } from './$types';
import {
  body,
  checkOrigin,
  failure,
  response,
  sessionCookie,
} from '$lib/server/http';
import { HttpError, login } from '../../../../../server/store.mjs';
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    checkOrigin(request);
    const data = await body(request, 4096);
    if (
      typeof data?.username !== 'string' ||
      typeof data?.password !== 'string' ||
      data.username.length > 100 ||
      data.password.length > 256
    )
      throw new HttpError(400, 'Enter your username and password.');
    const result = await login(data.username, data.password);
    cookies.set(sessionCookie, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure:
        process.env.COOKIE_SECURE === 'true' ||
        (
          process.env.APP_ORIGIN ||
          process.env.ORIGIN ||
          request.url
        ).startsWith('https:'),
      path: '/',
      maxAge: 7 * 86400,
    });
    return response({ user: result.user });
  } catch (error) {
    return failure(error);
  }
};
