import type { RequestHandler } from './$types';
import {
  body,
  checkOrigin,
  failure,
  response,
  title,
  user,
} from '$lib/server/http';
import { createDiagram, listDiagrams } from '../../../../server/store.mjs';
export const GET: RequestHandler = async (event) => {
  try {
    return response({ diagrams: listDiagrams(user(event).id) });
  } catch (error) {
    return failure(error);
  }
};
export const POST: RequestHandler = async (event) => {
  try {
    checkOrigin(event.request);
    const owner = user(event);
    const data = await body(event.request, 4096);
    return response(
      {
        diagram: createDiagram(
          owner.id,
          title(data?.title),
          data?.folder_id ?? null,
        ),
      },
      201,
    );
  } catch (error) {
    return failure(error);
  }
};
