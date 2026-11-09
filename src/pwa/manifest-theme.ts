/**
 * :Project:  suona-la-nota -- the manifest that matches the system's theme
 * :Created:  lun 09 nov 2026 17:55:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The splash screen of an installed application comes from its manifest, the
 * manifest is one file, and the system's theme is two colours. The way out is
 * to emit two manifests and point the `rel="manifest"` link at the one that
 * matches: the browser reads it when the application is installed, so the
 * choice made here is the one that gets installed.
 *
 * One limitation, and it is the platform's: a system that flips after the
 * installation does not repaint the stored splash. The page keeps the link up
 * to date anyway, so a later re-read of the manifest (the browser does refresh
 * it) lands on the right variant.
 */
import { MANIFEST_LIGHT_PATH, MANIFEST_PATH } from './manifest';

/** The manifest a system in this theme should install. */
export function manifestHrefFor(light: boolean): string {
  return light ? MANIFEST_LIGHT_PATH : MANIFEST_PATH;
}

/**
 * Point the manifest link at the right variant now, and again whenever the
 * system flips its theme before the reader installs the application.
 */
export function applyManifestTheme(
  link: HTMLLinkElement,
  query: MediaQueryList = window.matchMedia('(prefers-color-scheme: light)'),
): void {
  const apply = (): void => {
    const href = manifestHrefFor(query.matches);
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  };
  apply();
  query.addEventListener('change', apply);
}
