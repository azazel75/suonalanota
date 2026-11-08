/**
 * :Project:  suona-la-nota -- the keyboard the teacher ticks
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The keyboard of the teacher's list, as geometry and nothing else: which keys
 * share a row, and how wide each of them is. No DOM, so that the rules can be
 * checked without a browser.
 *
 * Three rules, and why:
 *
 *  - a row is an octave, and it starts on a C, the only key with no black key
 *    before it. Seven white keys across are what fits a 390 px phone with a
 *    finger-sized target on each; a single run of the whole range would shrink
 *    the keys below what a child can hit;
 *  - every white key takes the same share of the row, and a row keeps the width
 *    of a full octave even when the range cuts it short, so that a key is as
 *    wide in the first row as in the last;
 *  - a black key sits on the boundary between two white ones, half of it over
 *    each; a row that begins on a black key keeps it inside the row instead of
 *    letting half of it hang off the edge.
 */
import { pitchClass } from '../audio/notes';
import { keysInRange, type KeyRange } from './staff';

/** The white keys of an octave: the width a row is measured in. */
export const OCTAVE_WHITES = 7;

/** The twelve pitch classes as the keyboard draws them: the sharps are the black keys. */
const BLACK_KEY_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** The only pitch class that opens an octave, and therefore a row. */
const C_PITCH_CLASS = 0;

/** A black key is narrower than the white ones it stands between. */
const BLACK_KEY_SHARE = 0.62;

/** How a key is drawn: a white key, a black one, or a black one with nothing under it. */
export type KeyShape = 'white' | 'black' | 'lone';

/** One key of a row, placed. */
export interface KeyBox {
  readonly midi: number;
  readonly shape: KeyShape;
  /** Width, in percent of the row. */
  readonly width: number;
  /** Distance from the left edge, in percent; `null` for the keys in the flow of the row. */
  readonly left: number | null;
}

/**
 * The keys of a range grouped by octave, each row starting at a C.
 */
export function octaveRows(range: KeyRange): number[][] {
  const rows: number[][] = [];
  for (const midi of keysInRange(range)) {
    if (rows.length === 0 || pitchClass(midi) === C_PITCH_CLASS) rows.push([]);
    rows[rows.length - 1].push(midi);
  }
  return rows;
}

/**
 * The keys of one row, in order, each with its width and its place. The black
 * keys are out of the flow: they are laid over the boundary between the two
 * white keys they follow, and never past either edge of the row.
 */
export function layoutRow(row: readonly number[]): KeyBox[] {
  const share = 100 / OCTAVE_WHITES;
  let placed = 0;

  return row.map((midi) => {
    if (!BLACK_KEY_PITCH_CLASSES.has(pitchClass(midi))) {
      placed++;
      return { midi, shape: 'white', width: share, left: null };
    }
    // A range that begins on a black key has no white key to stand on: the key
    // stands on its own, at the width of a white one.
    if (placed === 0) return { midi, shape: 'lone', width: share, left: null };

    const width = share * BLACK_KEY_SHARE;
    const left = Math.min(100 - width, Math.max(0, placed * share - width / 2));
    return { midi, shape: 'black', width, left };
  });
}
