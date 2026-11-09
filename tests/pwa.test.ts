/**
 * :Project:  suona-la-nota -- the worker and the manifest, checked without a browser
 * :Created:  lun 09 nov 2026 00:30:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The worker is text the build writes, so the tests hold it as text: the
 * version is a function of the shell, the install caches exactly the shell, a
 * navigation gets the shell and a spike page does not. The emitted source runs
 * in node against a fake scope and fake caches — the same bytes the browser
 * would get — so a lost leading slash or a missing branch fails here and not in
 * class.
 */
import { describe, expect, it } from 'vitest';

import { MANIFEST, manifestJson } from '../src/pwa/manifest';
import { appShell, fileContent, referencesIn, type Bundle } from '../src/pwa/shell';
import {
  CACHE_PREFIX,
  cacheVersion,
  serviceWorkerSource,
  type ShellFile,
} from '../src/pwa/service-worker';

const ORIGIN = 'https://example.test';

/** A shell as the build hands it over: seven files, no spike among them. */
const SHELL = [
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/index.html',
  '/manifest.json',
  '/assets/app-abc123.js',
];

/** Enough of `Request` for what the worker looks at. */
interface FakeRequest {
  method: string;
  url: string;
  mode: string;
}

function request(path: string, mode = 'cors'): FakeRequest {
  return { method: 'GET', url: `${ORIGIN}${path}`, mode };
}

function shellBodies(): Record<string, string> {
  return Object.fromEntries(SHELL.map((path) => [path, `body of ${path}`]));
}

/**
 * A cache keyed by path, with the answers `caches.match` gives in a browser and
 * a note of what install added and activate deleted.
 */
function memoryCaches(bodies: Record<string, string>) {
  const entries = new Map<string, string>();
  const added: string[] = [];
  const deleted: string[] = [];
  const existing = new Set<string>();

  const cache = {
    async addAll(urls: string[]): Promise<void> {
      for (const url of urls) {
        added.push(url);
        const body = bodies[url];
        if (body === undefined) throw new TypeError(`no response for ${url}`);
        entries.set(url, body);
      }
    },
    async match(key: string | FakeRequest): Promise<Response | undefined> {
      const path = typeof key === 'string' ? key : new URL(key.url).pathname;
      const body = entries.get(path);
      return body === undefined ? undefined : new Response(body);
    },
  };

  return {
    async open(): Promise<typeof cache> {
      return cache;
    },
    async keys(): Promise<string[]> {
      return [...existing];
    },
    async delete(name: string): Promise<boolean> {
      deleted.push(name);
      existing.delete(name);
      return true;
    },
    added,
    deleted,
    /** What the builds before this one left on the device. */
    seed(...names: string[]): void {
      for (const name of names) existing.add(name);
    },
  };
}

type Caches = ReturnType<typeof memoryCaches>;

/** The worker, run the way a scope runs it: one `self`, one handler per event. */
function loadWorker(source: string, caches: Caches) {
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const waiting: Promise<void>[] = [];
  const online = async (input: FakeRequest): Promise<Response> => {
    if (input.url.endsWith('/offline')) throw new TypeError('the network is down');
    return new Response(`network:${input.url}`);
  };

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: (event: Record<string, unknown>) => void): void => {
      handlers.set(type, handler);
    },
    skipWaiting: async (): Promise<void> => undefined,
    clients: { claim: async (): Promise<void> => undefined },
  };

  new Function('self', 'caches', 'fetch', 'Response', 'URL', source)(self, caches, online, Response, URL);

  return {
    handlers,
    /** Fire install or activate and let the promise the event carries finish. */
    async fire(type: string): Promise<void> {
      handlers.get(type)?.({ waitUntil: (promise: Promise<void>) => waiting.push(promise) });
      await Promise.all(waiting.splice(0));
    },
  };
}

type Worker = ReturnType<typeof loadWorker>;

/** One fetch event: the response the worker answers with, or null if it stays out. */
function answer(worker: Worker, asked: FakeRequest): Promise<Response> | null {
  let responded: Promise<Response> | null = null;
  worker.handlers.get('fetch')?.({
    request: asked,
    respondWith: (promise: Promise<Response>) => {
      responded = promise;
    },
  });
  return responded;
}

/** A worker that has installed and activated, ready to answer fetches. */
async function liveWorker(bodies = shellBodies(), source = serviceWorkerSource(SHELL, 'v1')) {
  const caches = memoryCaches(bodies);
  const worker = loadWorker(source, caches);
  await worker.fire('install');
  await worker.fire('activate');
  return { caches, worker };
}

describe('the service worker the build writes', () => {
  it('gives the same shell the same version, whatever order it arrives in', () => {
    const files: ShellFile[] = [
      { path: '/assets/app.js', content: 'const a = 1;' },
      { path: '/index.html', content: '<!doctype html>' },
    ];

    expect(cacheVersion(files)).toBe(cacheVersion([...files].reverse()));
    expect(cacheVersion(files)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('gives a new version as soon as one byte of the shell changes', () => {
    const before = cacheVersion([{ path: '/assets/app.js', content: 'const a = 1;' }]);
    const after = cacheVersion([{ path: '/assets/app.js', content: 'const a = 2;' }]);
    const renamed = cacheVersion([{ path: '/assets/app-abcd.js', content: 'const a = 1;' }]);

    expect(after).not.toBe(before);
    expect(renamed).not.toBe(before);
  });

  it('names its cache after the version, under a prefix it owns', () => {
    const source = serviceWorkerSource(SHELL, '0123456789abcdef');

    expect(source).toContain(`const CACHE = "${CACHE_PREFIX}0123456789abcdef";`);
    expect(source).toContain(`const PREFIX = "${CACHE_PREFIX}";`);
  });

  it('precaches exactly the files it was given, and nothing else', async () => {
    const { caches } = await liveWorker();

    expect(caches.added).toEqual(SHELL);
    expect(caches.added).not.toContain('/sw.js');
    expect(caches.added.some((path) => path.startsWith('/spike/'))).toBe(false);
  });

  it('empties the caches of the builds before it, and only those', async () => {
    const caches = memoryCaches(shellBodies());
    caches.seed(`${CACHE_PREFIX}old`, `${CACHE_PREFIX}v1`, 'somebody-else');
    const worker = loadWorker(serviceWorkerSource(SHELL, 'v1'), caches);

    await worker.fire('install');
    await worker.fire('activate');

    expect(caches.deleted).toEqual([`${CACHE_PREFIX}old`]);
  });

  it('answers a navigation with the shell, whatever address and query it carries', async () => {
    const { worker } = await liveWorker({ ...shellBodies(), '/index.html': '<!doctype html>the shell' });

    for (const path of ['/', '/?duration=30&autostart=1', '/qualunque/indirizzo']) {
      const responded = answer(worker, request(path, 'navigate'));

      expect(responded).not.toBeNull();
      await expect(responded!.then((response) => response.text())).resolves.toBe('<!doctype html>the shell');
    }
  });

  it('does not answer a navigation to a spike page: offline it stays a network error', async () => {
    const { worker } = await liveWorker();

    expect(answer(worker, request('/spike/ascolto.html', 'navigate'))).toBeNull();
  });

  it('serves a file of the shell from the cache and leaves the rest to the network', async () => {
    const { worker } = await liveWorker({ ...shellBodies(), '/assets/app-abc123.js': 'the bundle' });

    await expect(answer(worker, request('/assets/app-abc123.js'))!.then((response) => response.text())).resolves.toBe(
      'the bundle'
    );
    expect(answer(worker, request('/assets/spike-ghi.js'))).toBeNull();
    expect(answer(worker, request('/qualcosa-che-non-e-nel-guscio.json'))).toBeNull();
  });

  it('falls back to the network when the cache has nothing to answer with', async () => {
    const worker = loadWorker(serviceWorkerSource(SHELL, 'v1'), memoryCaches({}));

    const responded = answer(worker, request('/index.html', 'navigate'));

    await expect(responded!.then((response) => response.text())).resolves.toBe(
      'network:https://example.test/index.html'
    );
  });

  it('fails honestly, not with the wrong page, when neither the cache nor the network answers', async () => {
    const worker = loadWorker(serviceWorkerSource(SHELL, 'v1'), memoryCaches({}));

    const responded = answer(worker, request('/offline', 'navigate'));

    await expect(responded!.then((response) => response.type)).resolves.toBe('error');
  });

  it('leaves requests that are not GET, or not ours, alone', async () => {
    const { worker } = await liveWorker();

    expect(answer(worker, { ...request('/index.html'), method: 'POST' })).toBeNull();
    expect(answer(worker, { ...request('/index.html'), url: 'https://another.test/index.html' })).toBeNull();
  });
});

describe('the manifest the build writes', () => {
  it('is the installed application: a name, a start, a display mode, the palette', () => {
    const manifest = JSON.parse(manifestJson()) as Record<string, unknown>;

    expect(manifest.name).toBe('Suona la nota');
    expect(manifest.short_name).toBe('Suona');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('it');
    expect(manifest.theme_color).toBe('#0b0f14');
    expect(manifest.background_color).toBe('#0b0f14');
  });

  it('carries the icons the package carries', () => {
    const manifest = JSON.parse(manifestJson()) as { icons: { src: string; type: string }[] };

    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/favicon.svg',
    ]);
    expect(manifest.icons.every((icon) => icon.type.startsWith('image/'))).toBe(true);
    expect(MANIFEST.icons[0].sizes).toBe('192x192');
  });

  it('is the same text twice, so the build stays reproducible', () => {
    expect(manifestJson()).toBe(manifestJson());
    expect(manifestJson().endsWith('\n')).toBe(true);
  });
});

/** A chunk of the bundle: the fields the shell reads, and no others. */
function chunk(fileName: string, code: string, imports: string[] = [], dynamicImports: string[] = []) {
  return { type: 'chunk' as const, fileName, code, imports, dynamicImports };
}

/** The page as Vite emits it: the module and its preload, a spike link in a <details>. */
const PAGE = [
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
  '<script type="module" crossorigin src="/assets/app-abc.js"></script>',
  '<link rel="modulepreload" crossorigin href="/assets/listener-def.js">',
  '<a href="/spike/ascolto.html">Lo spike dell\'ascolto</a>',
].join('\n');

function bundle(): Bundle {
  return {
    'index.html': { type: 'asset', fileName: 'index.html', source: PAGE },
    'assets/app-abc.js': chunk('assets/app-abc.js', 'const app = 1;', ['assets/listener-def.js']),
    'assets/listener-def.js': chunk('assets/listener-def.js', 'const listener = 1;'),
    'assets/spike-ghi.js': chunk('assets/spike-ghi.js', 'const spike = 1;'),
    'spike/ascolto.html': { type: 'asset', fileName: 'spike/ascolto.html', source: '<html></html>' },
  };
}

describe('the shell the build picks', () => {
  it('reads the scripts and the links of the page, and not its anchors', () => {
    expect(referencesIn(PAGE)).toEqual(['/favicon.svg', '/assets/app-abc.js', '/assets/listener-def.js']);
  });

  it('is the page and what it loads — never a spike page, never a file it cannot version', () => {
    expect(appShell(bundle())).toEqual([
      '/assets/app-abc.js',
      '/assets/listener-def.js',
      '/index.html',
    ]);
  });

  it('follows the imports of a chunk, and its stylesheets, once each', () => {
    const withCss: Bundle = {
      'index.html': {
        type: 'asset',
        fileName: 'index.html',
        source: '<script type="module" src="/assets/app.js"></script>',
      },
      'assets/app.js': {
        ...chunk('assets/app.js', 'app', ['/assets/shared.js', 'assets/only-once.js']),
        viteMetadata: { importedCss: ['assets/app.css'] },
      },
      'assets/shared.js': chunk('assets/shared.js', 'shared', ['assets/only-once.js']),
      'assets/only-once.js': chunk('assets/only-once.js', 'once'),
      'assets/app.css': { type: 'asset', fileName: 'assets/app.css', source: 'body{}' },
    };

    expect(appShell(withCss)).toEqual(
      ['/assets/app.css', '/assets/app.js', '/assets/only-once.js', '/assets/shared.js', '/index.html'].sort(),
    );
  });

  it("hashes the bundle's bytes, and leaves public/ out of the shell", () => {
    expect(fileContent(bundle(), '/assets/app-abc.js')).toBe('const app = 1;');
    expect(fileContent(bundle(), '/index.html')).toBe(PAGE);
    expect(fileContent(bundle(), '/icons/icon-192.png')).toBe('');
    // A file Vite copies from public/ never enters the bundle, so it cannot enter
    // the cache version: it stays out of the shell rather than going stale.
    const page: Bundle = {
      'index.html': {
        type: 'asset',
        fileName: 'index.html',
        source: '<link rel="icon" href="/favicon.svg" /><script src="/assets/app.js"></script>',
      },
      'assets/app.js': chunk('assets/app.js', 'app'),
    };
    expect(appShell(page)).toEqual(['/assets/app.js', '/index.html']);
  });
});
