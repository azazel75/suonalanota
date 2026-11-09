/**
 * :Project:  suona-la-nota -- the build: one app shell, three spikes, a PWA
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Four entry points, because the spikes are diagnostic tools and not part of
 * the exercise: they ship in the same static directory, at /spike/*.html.
 *
 * The manifest and the service worker are not written by hand: a plugin emits
 * them at the end of the bundle, when the list of emitted files — hashed names
 * and all — is exactly what the worker has to keep. `enforce: 'post'` puts that
 * plugin after Vite's own HTML pass, without which index.html is not in the
 * bundle yet. What the shell is, and what the worker says, live in
 * `src/pwa/` where node can test them: this file only wires them to the build.
 */
import type { OutputBundle } from 'rolldown';
import { defineConfig, type Plugin } from 'vitest/config';

import {
  MANIFEST_LIGHT_PATH,
  MANIFEST_PATH,
  manifestJson,
} from './src/pwa/manifest';
import {
  WORKER_REVISION,
  cacheVersion,
  serviceWorkerSource,
  type ShellFile,
} from './src/pwa/service-worker';
import { appShell, fileContent } from './src/pwa/shell';

const MANIFEST_FILE = MANIFEST_PATH.slice(1);
const MANIFEST_LIGHT_FILE = MANIFEST_LIGHT_PATH.slice(1);
const SW_FILE = 'sw.js';

/** Manifest and worker, from the files this very build emitted. */
function pwa(): Plugin {
  return {
    name: 'suona-la-nota:pwa',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle: OutputBundle) {
      const manifest = manifestJson();
      this.emitFile({ type: 'asset', fileName: MANIFEST_FILE, source: manifest });
      // The splash screen of the installed application is the manifest's
      // background, and one file cannot be two colours: the page picks the
      // variant that matches the system (ADR 0023). The light one is not in the
      // shell — the browser reads it at install time, from the network — and it
      // is versioned through the dark one, emitted from the same code.
      this.emitFile({
        type: 'asset',
        fileName: MANIFEST_LIGHT_FILE,
        source: manifestJson('light'),
      });

      const shell = appShell(bundle);
      const version = cacheVersion([
        ...shell.map((path): ShellFile => ({ path, content: fileContent(bundle, path) })),
        { path: MANIFEST_PATH, content: manifest },
        { path: '@worker', content: WORKER_REVISION },
      ]);

      this.emitFile({ type: 'asset', fileName: SW_FILE, source: serviceWorkerSource(shell, version) });
    },
  };
}

export default defineConfig({
  plugins: [pwa()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        app: 'index.html',
        spike: 'spike/ascolto.html',
        dispari: 'spike/dispari.html',
        salita: 'spike/salita.html',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
