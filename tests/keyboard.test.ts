/**
 * :Project:  suona-la-nota -- the keyboard of the teacher's list, checked without a browser
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The keyboard is the only place where a child touches the exercise before it
 * starts, so its geometry is worth a test of its own: a key that runs off the
 * row or a black key that hides a white one is a finger landing on the wrong
 * note. The rows are the octaves, and the widths are shares of the row, which
 * is what keeps a key as wide in the last row as in the first.
 */
import { describe, expect, it } from 'vitest';

import { OCTAVE_WHITES, layoutRow, octaveRows } from '../src/score/keyboard';
import { ADVANCED_RANGE, BASE_RANGE, keysInRange } from '../src/score/staff';

/** The width of a white key, in percent of the row. */
const SHARE = 100 / OCTAVE_WHITES;

describe('the rows of the keyboard', () => {
  it('puts one octave on one row, from the C to the B', () => {
    expect(octaveRows({ lowest: 60, highest: 71 })).toEqual([
      [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71],
    ]);
  });

  it('starts a new row at every C, and lets the last one be short', () => {
    const rows = octaveRows(BASE_RANGE);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row[0])).toEqual([48, 60, 72]);
    expect(rows[2]).toEqual([72]);
  });

  it('keeps a range that begins on a black key on a single row', () => {
    expect(octaveRows({ lowest: 61, highest: 64 })).toEqual([[61, 62, 63, 64]]);
  });

  it('covers every key of the range exactly once', () => {
    const drawn = octaveRows(ADVANCED_RANGE).flat();

    expect(drawn).toEqual(keysInRange(ADVANCED_RANGE));
  });
});

describe('the shape of the keys of a row', () => {
  it('gives the seven white keys of an octave the same share of the row', () => {
    const whites = layoutRow([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71]).filter(
      (box) => box.shape === 'white',
    );

    expect(whites).toHaveLength(OCTAVE_WHITES);
    for (const box of whites) expect(box.width).toBeCloseTo(SHARE);
    expect(whites.reduce((sum, box) => sum + box.width, 0)).toBeCloseTo(100);
  });

  it('sits a black key on the boundary between the two white ones', () => {
    const boxes = layoutRow([60, 61, 62]);
    const [cSharp] = boxes.filter((box) => box.shape === 'black');

    expect(cSharp.midi).toBe(61);
    expect(cSharp.width).toBeCloseTo(SHARE * 0.62);
    // The C is the first white key, so the C sharp straddles the line after it.
    expect(cSharp.left).toBeCloseTo(SHARE - cSharp.width / 2);
  });

  it('stands a black key that begins the range on its own, at a white key width', () => {
    const [lone] = layoutRow([61, 62]);

    expect(lone.shape).toBe('lone');
    expect(lone.width).toBeCloseTo(SHARE);
    expect(lone.left).toBeNull();
  });

  it('keeps every key inside its row, in the order of the range', () => {
    for (const row of octaveRows(ADVANCED_RANGE)) {
      const boxes = layoutRow(row);

      expect(boxes.map((box) => box.midi)).toEqual(row);
      for (const box of boxes) {
        if (box.left === null) continue;
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.left + box.width).toBeLessThanOrEqual(100.000001);
      }
    }
  });
});
