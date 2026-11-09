/**
 * :Project:  suona-la-nota -- the sentences of the page, and their agreement
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * A summary a teacher reads aloud has to agree with what it counts: "1
 * corretta" but "3 corrette". It is one function and three lines, and it is
 * tested because getting it wrong is the kind of mistake nobody notices on the
 * screen and everybody hears in the sentence.
 */
import { describe, expect, it } from 'vitest';

import { count } from '../src/ui/text';

describe('counting out loud', () => {
  it('keeps the singular for one', () => {
    expect(count(1, 'corretta', 'corrette')).toBe('1 corretta');
    expect(count(1, 'tasto', 'tasti')).toBe('1 tasto');
  });

  it('uses the plural for everything else', () => {
    expect(count(0, 'corretta', 'corrette')).toBe('0 corrette');
    expect(count(3, 'corretta', 'corrette')).toBe('3 corrette');
    expect(count(21, 'tasto', 'tasti')).toBe('21 tasti');
  });

  it('takes a rate already written the Italian way, and still agrees', () => {
    expect(count('8,5', 'nota', 'note')).toBe('8,5 note');
    expect(count('1', 'nota', 'note')).toBe('1 nota');
  });
});
