/**
 * :Project:  suona-la-nota -- the build: one app shell and the audio spike
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Two entry points, because the spike is a diagnostic tool and not part of the
 * exercise: it ships in the same static directory, at /spike/ascolto.html.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        app: 'index.html',
        spike: 'spike/ascolto.html',
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
