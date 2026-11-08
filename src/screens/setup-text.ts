/**
 * :Project:  suona-la-nota -- the line under the keyboard of the list
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The sentences of the setup screen, without the screen: a teacher reads them
 * before a session starts, so they are worth a test of their own. The one that
 * matters is the third: a key outside the active range stays in the list and is
 * not asked, and saying it before the session starts is the difference between
 * a didactic choice and a bug.
 */
import { isInRange, type KeyRange } from '../score/staff';
import { count } from '../ui/text';

/**
 * How many keys the list holds, and how many of them the range in force will
 * not ask for.
 */
export function describeList(keys: readonly number[], range: KeyRange): string {
  if (keys.length === 0) {
    return 'La lista è vuota: tocca i tasti per scegliere le note da chiedere.';
  }
  const parts = [`${count(keys.length, 'tasto', 'tasti')} nella lista.`];
  const outside = keys.filter((key) => !isInRange(key, range)).length;
  if (outside === 1) parts.push('Un tasto è fuori dal range attivo: non verrà chiesto.');
  else if (outside > 1) parts.push(`${outside} tasti sono fuori dal range attivo: non verranno chiesti.`);
  return parts.join(' ');
}
