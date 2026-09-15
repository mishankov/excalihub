import type { RequestHandler } from './$types';
import { body, checkOrigin, failure, response, user } from '$lib/server/http';
import { renameFolder, deleteFolder } from '../../../../../server/store.mjs';
export const PATCH: RequestHandler = async (event) => {
  try {
    checkOrigin(event.request);
    const owner = user(event);
    const data = await body(event.request, 4096);
    return response({
      folder: renameFolder(owner.id, event.params.id, data?.name),
    });
  } catch (error) {
    return failure(error);
  }
};
export const DELETE: RequestHandler = async (event) => {
  try {
    checkOrigin(event.request);
    deleteFolder(user(event).id, event.params.id);
    return response({ ok: true });
  } catch (error) {
    return failure(error);
  }
};
