import { GAMES } from '../src/lib/games';

// The pages a visitor can reach without a room, shared by the whole-site UX checks (sideways scroll,
// keyboard focus, contrast, ...), so a new tool page is covered the day it is added to the catalogue.
const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) => href.startsWith('/tools/'));

export const SITE_PAGES = [
  '/',
  '/tools',
  '/explore',
  '/create',
  '/for-teachers',
  '/spintra-city',
  '/settings',
  '/legal/terms',
  '/legal/privacy',
  ...toolPaths,
];

/** A path that does not exist, for the 404 page. */
export const NOT_FOUND_PATH = '/this-page-does-not-exist';
