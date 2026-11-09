/**
 * :Project:  suona-la-nota -- the manifest of the installed application
 * :Created:  lun 09 nov 2026 00:30:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The manifest is data, not part of the worker: it says what the application is
 * called and how it appears once installed, and the worker only has to keep it
 * in the cache. It lives beside the worker because both are written by the same
 * build, and it is a separate module because a name that says "manifest" should
 * not have to be searched for in a file called `service-worker`.
 */

/**
 * Where the manifest is emitted, both as a URL and as a bundle path. It is
 * `.json` on purpose: a static host serves that as `application/json` without
 * anyone editing a MIME table, while `.webmanifest` comes out as a download and
 * Chrome refuses it — an install that fails silently is worse than a suffix.
 */
export const MANIFEST_PATH = '/manifest.json';

/**
 * The manifest, in the colours of the page (`--bg` in `index.html`), with the
 * icons the package carries. `short_name` is «Suona»: «Suona la nota» under an
 * icon on a phone is cut to «Suona la…».
 */
export const MANIFEST = {
  name: 'Suona la nota',
  short_name: 'Suona',
  description: 'Esercizi di lettura del pentagramma con ascolto dal microfono',
  lang: 'it',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#0b0f14',
  theme_color: '#0b0f14',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
} as const;

/** The manifest as the file the build writes: indented, one trailing newline. */
export function manifestJson(): string {
  return `${JSON.stringify(MANIFEST, null, 2)}\n`;
}
