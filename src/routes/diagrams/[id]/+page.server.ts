import { error, redirect } from '@sveltejs/kit';
import { getDiagram, HttpError } from '../../../../server/store.mjs';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals, params }) => {
  if (!locals.user) redirect(303, '/');
  try {
    return { diagram: getDiagram(locals.user.id, params.id) };
  } catch (e) {
    if (e instanceof HttpError) error(e.status, e.message);
    throw e;
  }
};
