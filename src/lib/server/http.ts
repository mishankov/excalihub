import { json, type RequestEvent } from '@sveltejs/kit';
import { HttpError } from '../../../server/store.mjs';
export const sessionCookie = 'excalihub_session';
export function response(data: unknown, status = 200) {
  return json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function user(event: RequestEvent) {
  if (!event.locals.user)
    throw new HttpError(401, 'Please sign in to continue.');
  return event.locals.user;
}
export function checkOrigin(request: Request) {
  const expected =
    process.env.APP_ORIGIN || process.env.ORIGIN || new URL(request.url).origin;
  if (request.headers.get('origin') !== expected)
    throw new HttpError(403, 'Request origin is not allowed.');
}
export async function body(request: Request, limit = 20 * 1024 * 1024) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'Expected JSON.');
  if (Number(request.headers.get('content-length')) > limit)
    throw new HttpError(413, 'Drawing is too large (20 MB maximum).');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Request body is required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, 'Drawing is too large (20 MB maximum).');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return response({ error: error.message }, error.status);
  console.error(error);
  return response({ error: 'Something went wrong. Please try again.' }, 500);
}
export function title(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120)
    throw new HttpError(400, 'Enter a title between 1 and 120 characters.');
  return value.trim();
}
