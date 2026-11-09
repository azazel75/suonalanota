/**
 * :Project:  suona-la-nota -- the files of the app shell, picked from the bundle
 * :Created:  lun 09 nov 2026 00:30:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The worker has to know what the shell is, and the only honest answer comes
 * from the build itself: index.html as Vite emitted it, and everything it loads,
 * followed through the chunks' imports.
 *
 * What `public/` contributes is deliberately not in it. Vite copies those files
 * without the bundle ever seeing their bytes, so they could not enter the cache
 * version — and a shell that cannot be versioned is a shell that goes stale
 * without anyone noticing (docs/adr/0016).
 *
 * What it does not contain is as important. A link to a spike page is a link,
 * not a file the shell needs: on an offline phone, a session is the exercise,
 * not the instrument the teacher measures it with. The spike pages are served
 * on demand by the network, and the worker never answers a navigation to one.
 *
 * This lives outside `vite.config.ts` because it is a rule, and a rule is
 * tested in node against a bundle shaped like the one Vite hands over.
 */
import { MANIFEST_PATH } from './manifest';

/** The page itself: the shell is the shell of this one address. */
export const SHELL_HTML = '/index.html';

/** Where the spike pages live. Never precached, never used as a fallback. */
export const SPIKE_PREFIX = '/spike/';

export interface EmittedChunk {
  type: 'chunk';
  fileName: string;
  code: string;
  imports: string[];
  dynamicImports: string[];
  viteMetadata?: { importedCss?: Iterable<string> };
}

export interface EmittedAsset {
  type: 'asset';
  fileName: string;
  source: string | Uint8Array;
}

export type EmittedFile = EmittedChunk | EmittedAsset;

/** The bundle as Vite hands it to `generateBundle`, keyed by file name. */
export type Bundle = Record<string, EmittedFile>;

/** One path, always rooted: the bundle keys drop the leading slash, URLs do not. */
function rooted(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * The files an emitted HTML page loads: `src` of a script, `href` of a link.
 * Anchors are deliberately not read — a link in the page is not a file the page
 * needs, and the spike pages are linked from the page.
 */
export function referencesIn(html: string): string[] {
  const references: string[] = [];

  for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
    const attribute = /\b(?:src|href)="([^"]*)"/.exec(tag[0]);
    if (attribute === null) continue;
    const url = attribute[1];
    if (url.startsWith('/') && !url.startsWith('//')) references.push(url);
  }

  return references;
}

/** The shell, sorted, with index.html first in spirit and /assets in fact. */
export function appShell(bundle: Bundle): string[] {
  const files = new Set<string>([SHELL_HTML]);
  const html = bundle[SHELL_HTML.slice(1)];
  const queue = html !== undefined && html.type === 'asset' ? referencesIn(String(html.source)) : [];

  while (queue.length > 0) {
    const path = rooted(queue.pop() as string);
    if (files.has(path)) continue;
    if (path.startsWith(SPIKE_PREFIX)) continue;
    // Only what the build can version. A file Vite copies from `public/` never
    // enters the bundle, so its bytes could not enter the cache version — and a
    // shell entry that cannot be versioned is one that goes stale in silence
    // (docs/adr/0016). The manifest is the exception: the same plugin emits it.
    const item = bundle[path.slice(1)];
    if (item === undefined && path !== MANIFEST_PATH) continue;
    files.add(path);
    if (item !== undefined && item.type === 'chunk') {
      queue.push(...item.imports.map(rooted), ...item.dynamicImports.map(rooted));
      for (const css of item.viteMetadata?.importedCss ?? []) queue.push(rooted(css));
    }
  }

  return [...files].sort();
}

/** The bytes of one shell file, as the version sees them. */
export function fileContent(bundle: Bundle, path: string): string {
  const item = bundle[path.replace(/^\//, '')];
  if (item === undefined) return ''; // public/: Vite copies it, the bundle never sees it
  if (item.type === 'chunk') return item.code;
  return typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source);
}
