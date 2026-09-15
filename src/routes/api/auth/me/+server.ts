import type { RequestHandler } from './$types';
import { failure, response, user } from '$lib/server/http';
export const GET: RequestHandler = async (event) => {
  try {
    return response({ user: user(event) });
  } catch (error) {
    return failure(error);
  }
};
