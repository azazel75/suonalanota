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
 * Nothing is shown to the child about the update: the worker calls skipWaiting
 * and claim, so a new build takes over at the next load, and a session in
 * progress is not interrupted by a prompt it cannot read.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  const register = (): void => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch(() => {
      // The exercise works with the network; the shell is what is lost.
    });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
