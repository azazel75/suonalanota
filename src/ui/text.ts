/**
 * :Project:  suona-la-nota -- the sentences the page writes, and their agreement
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * A summary a teacher reads aloud has to agree with what it counts: "1
 * corretta" but "3 corrette", "1 nota al minuto" but "4,5 note al minuto". One
 * function, because a page that says "1 corrette" is a page nobody trusts with
 * a mark.
 */
export function count(value: number | string, one: string, many: string): string {
  // A rate arrives already written the Italian way (`8,5`), and what decides the
  // singular is only whether it is exactly one.
  const text = typeof value === 'number' ? String(value) : value;
  return `${text} ${text === '1' ? one : many}`;
}
