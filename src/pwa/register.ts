/**
 * :Project:  suona-la-nota -- the page asks for its service worker
 * :Created:  lun 09 nov 2026 00:30:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * One function, called once from the end of `main()`: in the built site the page
 * installs the shell for the next visit, offline included. In `npm run dev`
 * there is no worker to install and none is asked for; a browser without service
 * workers is a browser where the page still works, with the network.
 *
 * A new version is offered, not imposed. The worker calls `skipWaiting` only when
 * it is the first one; a later version waits, the page says so with a bar, and
 * the reload happens when the reader taps it — never in the middle of a session.
 * The check itself is asked for twice: once when the page loads and once every
 * time it comes back to the foreground, because the browser's own check can be a
 * day apart and a teacher opening the app is exactly the moment to ask.
 */
/** The registration this page holds, once it has one. */
let registration: ServiceWorkerRegistration | null = null;

/** Whether this page asked for the update — and therefore may reload itself. */
let asked = false;

export function registerServiceWorker(onUpdate: () => void): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  const register = (): void => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((ready) => {
        registration = ready;
        const offer = (): void => {
          // A worker is waiting and one is already serving: this is an update,
          // not the first visit.
          if (ready.waiting !== null && navigator.serviceWorker.controller !== null) onUpdate();
        };
        ready.addEventListener('updatefound', () => {
          const installing = ready.installing;
          if (installing === null) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') offer();
          });
        });
        // A version may have been waiting since the last visit, before this
        // page asked anything.
        offer();
        void ready.update();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void ready.update();
        });
      })
      .catch(() => {
        // The exercise works with the network; the shell is what is lost.
      });
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first worker also claims this page, and reloading then would be a
    // surprise: only a page that asked for the update reloads itself.
    if (asked) location.reload();
  });

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/** Take the worker that is waiting: it takes over, and the page reloads once. */
export function applyUpdate(): void {
  const waiting = registration?.waiting ?? null;
  if (waiting === null) return;
  asked = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
