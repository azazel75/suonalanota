/**
 * :Project:  suona-la-nota -- what the page needs from the browser
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Two things every screen needs and none of them owns: the element with an id,
 * or a sentence saying which id is missing — a page that quietly does nothing
 * is worse than a page that says why — and the way a file leaves the page.
 */
export function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`#${id} is missing from the page`);
  return found as T;
}

/**
 * Hand a file over: a Blob, a link the page clicks for it, and the object URL
 * revoked once the browser has had time to start the download. One function for
 * both files the page produces, because the timing of that revoke is not a
 * detail to get right twice.
 */
export function saveFile(name: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking at once cuts the download off on some browsers; a second is enough.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
