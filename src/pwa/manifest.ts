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
 *
 * The manifest carries the colours of the **splash screen** — the rectangle the
 * operating system shows for a moment while the application starts — and one
 * file cannot be two colours. So the build emits two, one per palette, and the
 * page points its `rel="manifest"` link at the one that matches the system
 * (`manifest-theme.ts`). The choice is taken when the application is installed,
 * which is the only moment the browser reads it (ADR 0023).
 */

/**
 * Where the manifests are emitted, both as URLs and as bundle paths. They are
 * `.json` on purpose: a static host serves that as `application/json` without
 * anyone editing a MIME table, while `.webmanifest` comes out as a download and
 * Chrome refuses it — an install that fails silently is worse than a suffix.
 */
export const MANIFEST_PATH = '/manifest.json';
/** The same manifest in the light palette, for a system that is already light. */
export const MANIFEST_LIGHT_PATH = '/manifest-light.json';

/** Which of the page's two palettes a manifest describes. */
export type ManifestScheme = 'dark' | 'light';

/** The page background and the browser's own chrome, per palette (`:root` in index.html). */
const COLOURS: Record<ManifestScheme, { background: string; theme: string }> = {
  dark: { background: '#0b0f14', theme: '#0b0f14' },
  light: { background: '#f4f2ec', theme: '#f4f2ec' },
};

/**
 * The manifest, in the colours of one palette, with the icons the package
 * carries. `short_name` is «Suona»: «Suona la nota» under an icon on a phone is
 * cut to «Suona la…».
 *
 * The icons do not follow the palette: they are a dark rounded square with the
 * note on it, and that is the application's face. A light splash with the dark
 * icon on it looks like an icon on a sheet of paper, which is what it is; a
 * dark splash at noon is a black flash in the eye. Only the field changes.
 */
function manifestFor(scheme: ManifestScheme) {
  const colour = COLOURS[scheme];
  return {
    name: 'Suona la nota',
    short_name: 'Suona',
    description: 'Esercizi di lettura del pentagramma con il microfono',
    lang: 'it',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: colour.background,
    theme_color: colour.theme,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}

/** The dark manifest, the one a page without the script keeps. */
export const MANIFEST = manifestFor('dark');
/** The light manifest, for a system that is light. */
export const MANIFEST_LIGHT = manifestFor('light');

/** The manifest as the file the build writes: indented, one trailing newline. */
export function manifestJson(scheme: ManifestScheme = 'dark'): string {
  return `${JSON.stringify(manifestFor(scheme), null, 2)}\n`;
}
