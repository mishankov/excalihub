import { redirect, error } from '@sveltejs/kit';
import {
  listDiagrams,
  listFolders,
  getFolder,
  HttpError,
} from '../../../server/store.mjs';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.user) redirect(303, '/');
  const selected = url.searchParams.get('folder') || 'all';
  if (selected !== 'all' && selected !== 'unfiled')
    try {
      getFolder(locals.user.id, selected);
    } catch (e) {
      if (e instanceof HttpError) error(e.status, e.message);
      throw e;
    }
  return {
    user: locals.user,
    diagrams: listDiagrams(locals.user.id),
    folders: listFolders(locals.user.id),
    selected,
  };
};
