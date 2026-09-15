import type { RequestHandler } from './$types';
import { body, checkOrigin, failure, response, user } from '$lib/server/http';
import { createFolder, listFolders } from '../../../../server/store.mjs';
export const GET: RequestHandler = async (event) => {
  try {
    return response({ folders: listFolders(user(event).id) });
  } catch (error) {
    return failure(error);
  }
};
export const POST: RequestHandler = async (event) => {
  try {
    checkOrigin(event.request);
    const owner = user(event);
    const data = await body(event.request, 4096);
    return response({ folder: createFolder(owner.id, data?.name) }, 201);
  } catch (error) {
    return failure(error);
  }
};
