/**
 * :Project:  suona-la-nota -- the version of this build
 * :Created:  lun 09 nov 2026 18:05:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The application says which build it is: the number comes from `package.json`,
 * the build injects it as a literal (`vite.config.ts`, `define`), and the line
 * under the bug shows it together with the licence and the way to the sources.
 * One number, in one place: a version typed twice is a version that lies.
 */

/** The version injected at build time from `package.json`. */
export const APP_VERSION: string = __APP_VERSION__;

/** The licence the package declares, and the one `LICENSE` carries. */
export const APP_LICENSE = 'GPL-3.0-or-later';

/** Where the source of this build lives. */
export const SOURCE_URL = 'https://github.com/azazel75/suonalanota';

/** The line under the bug: version, licence, and a link to the sources. */
export function aboutText(): string {
  return `versione ${APP_VERSION} · ${APP_LICENSE}`;
}
