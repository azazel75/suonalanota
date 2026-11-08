/**
 * :Project:  suona-la-nota -- the line under the keyboard of the list
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Three cases and three sentences: the empty list, a list the active range
 * covers, and a list with keys the range will not ask for. The third is the one
 * that matters — a key outside the range stays in the list and is not asked,
 * and the screen has to say so before the session starts, not after.
 */
import { describe, expect, it } from 'vitest';

import { describeList } from '../src/screens/setup-text';
import { BASE_RANGE } from '../src/score/staff';

describe('the line under the keyboard', () => {
  it('invites the teacher to tick something when the list is empty', () => {
    expect(describeList([], BASE_RANGE)).toBe(
      'La lista è vuota: tocca i tasti per scegliere le note da chiedere.',
    );
  });

  it('counts the keys of the list, one or many', () => {
    expect(describeList([60], BASE_RANGE)).toBe('1 tasto nella lista.');
    expect(describeList([60, 62], BASE_RANGE)).toBe('2 tasti nella lista.');
  });

  it('says how many keys of the list the range will not ask for', () => {
    expect(describeList([60, 40], BASE_RANGE)).toBe(
      '2 tasti nella lista. Un tasto è fuori dal range attivo: non verrà chiesto.',
    );
    expect(describeList([60, 40, 41], BASE_RANGE)).toBe(
      '3 tasti nella lista. 2 tasti sono fuori dal range attivo: non verranno chiesti.',
    );
  });
});
