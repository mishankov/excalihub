import type { RequestHandler } from './$types';
import {
  body,
  checkOrigin,
  failure,
  response,
  title,
  user,
} from '$lib/server/http';
import {
  deleteDiagram,
  moveDiagram,
  renameDiagram,
  getDiagram,
  HttpError,
  saveDiagram,
} from '../../../../../server/store.mjs';
export const GET: RequestHandler = async (event) => {
  try {
    return response({ diagram: getDiagram(user(event).id, event.params.id) });
  } catch (error) {
    return failure(error);
  }
};
export const PUT: RequestHandler = async (event) => {
  try {
    checkOrigin(event.request);
    const owner = user(event);
    const data = await body(event.request);
    const cleanTitle = title(data?.title);
    if (
      !Number.isSafeInteger(data.version) ||
      data.version < 1 ||
      !data.scene ||
      !Array.isArray(data.scene.elements) ||
      !data.scene.appState ||
      typeof data.scene.appState !== 'object' ||
      Array.isArray(data.scene.appState) ||
      !data.scene.files ||
      typeof data.scene.files !== 'object' ||
      Array.isArray(data.scene.files)
    )
      throw new HttpError(400, 'Invalid drawing data.');
    for (const preview of [data.thumbnail, data.thumbnail_dark]) {
      if (
        preview != null &&
        (typeof preview !== 'string' ||
          preview.length > 1_000_000 ||
          !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(preview))
      )
        throw new HttpError(400, 'Invalid preview image.');
    }
    return response({
      diagram: saveDiagram(owner.id, event.params.id, {
        ...data,
        title: cleanTitle,
      }),
    });
  } catch (error) {
    return failure(error);
  }
};
export const DELETE: RequestHandler = async (event) => {
  try {
    checkOrigin(event.request);
    deleteDiagram(user(event).id, event.params.id);
    return response({ ok: true });
  } catch (error) {
    return failure(error);
  }
};

export const PATCH: RequestHandler = async (event) => {
  try {
    checkOrigin(event.request);
    const owner = user(event);
    const data = await body(event.request, 4096);
    if (data && Object.hasOwn(data, 'title')) {
      if (!Number.isSafeInteger(data.version) || data.version < 1)
        throw new HttpError(400, 'Invalid diagram version.');
      return response({
        diagram: renameDiagram(
          owner.id,
          event.params.id,
          title(data.title),
          data.version,
        ),
      });
    }
    if (data?.folder_id !== null && typeof data?.folder_id !== 'string')
      throw new HttpError(400, 'Choose a folder or Unfiled.');
    return response({
      diagram: moveDiagram(owner.id, event.params.id, data.folder_id),
    });
  } catch (error) {
    return failure(error);
  }
};
