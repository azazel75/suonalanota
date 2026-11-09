/**
 * :Project:  suona-la-nota -- the map from a key to a place on the staff
 * :Created:  dom 08 nov 2026 22:05:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * A key is not a note (CONTEXT.md): a note is a position on the staff plus a
 * clef, and the same key has more than one writing. This module is the table
 * that says which writing the exercise uses — a wrong row here is a wrong note
 * in front of a ten-year-old, so it stays pure and fully testable, with no
 * VexFlow and no DOM in sight.
 *
 * Positions are counted in diatonic steps above the bottom line: step 0 is the
 * first line, step 8 the fifth, the odd steps are the spaces between them, a
 * negative step is below the staff and above 8 is above it. VexFlow's own
 * `line` is twice the step plus two (`(step + 2) / 2`), so the whole table can
 * be cross-checked against the library instead of being taken on trust.
 *
 * The clef is the one that leaves the note nearest the five lines, counted as
 * the number of steps outside them: the low notes go to the bass clef, the
 * high ones to the treble. Only the middle C position — Do4, and the black key
 * on the same place — is equally near in both writings: one ledger line above
 * the bass staff, one below the treble. There the map alternates, because both
 * writings are worth learning and neither is wrong.
 *
 * Black keys are always spelled with a sharp. The map has no key signature to
 * carry a flat, and a sharp is the accidental a beginner meets first.
 */

/** The two clefs the exercise uses. */
export type Clef = 'treble' | 'bass';

/** An interval of keys, lowest and highest included. */
export interface KeyRange {
  readonly lowest: number;
  readonly highest: number;
}

/** The base interval: Do3–Do5. */
export const BASE_RANGE: KeyRange = { lowest: 48, highest: 72 };

/** The advanced interval: Si1–Re6. */
export const ADVANCED_RANGE: KeyRange = { lowest: 35, highest: 86 };

/** Everything the exercise needs to draw one target. */
export interface Placement {
  readonly midi: number;
  readonly clef: Clef;
  /** The key as VexFlow spells it, e.g. `f#/4`. */
  readonly vexKey: string;
  /** `#` when the note needs an accidental drawn next to it, `null` otherwise. */
  readonly accidental: '#' | null;
  /** Diatonic steps above the bottom line: 0 is the first line, 8 the fifth. */
  readonly step: number;
  /** The ledger lines to draw, as step indexes: negative below the staff. */
  readonly ledgerLines: readonly number[];
}

/** Letter of each pitch class, lowest first: the map writes only sharps. */
const SPELLING = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

/** Where each letter sits inside its octave, C = 0: C D E F G A B. */
const LETTER_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

/** Diatonic index of the bottom line: E4 in the treble clef, G2 in the bass. */
const BOTTOM_LINE: Readonly<Record<Clef, number>> = { treble: 30, bass: 18 };

/** Diatonic index of the top line: four spaces above the bottom one. */
const TOP_LINE = 8;

const LOWEST_KEY = 0;
const HIGHEST_KEY = 127;

/** Reject what is not a key at all, before a wrong row can reach the screen. */
function checkKey(midi: number): void {
  if (!Number.isInteger(midi) || midi < LOWEST_KEY || midi > HIGHEST_KEY) {
    throw new RangeError(`not a MIDI key: ${midi}`);
  }
}

/** Diatonic steps from C0: the difference of two is the distance on the staff. */
function diatonicIndex(midi: number): number {
  return (Math.floor(midi / 12) - 1) * 7 + LETTER_STEP[midi % 12];
}

/** Scientific octave number, the one VexFlow puts after the slash. */
function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/**
 * The ledger lines a position needs, as step indexes.
 *
 * The space just outside the staff (step -1 below, 9 above) needs none: the
 * first ledger line is a whole step further out, and the ones above follow
 * every two steps from there.
 */
function ledgerLinesFor(step: number): number[] {
  const lines: number[] = [];
  if (step < 0) {
    for (let line = -2; line >= step; line -= 2) lines.push(line);
  } else {
    for (let line = TOP_LINE + 2; line <= step; line += 2) lines.push(line);
  }
  return lines;
}

/** The key written in a given clef, whether or not that is the nearest one. */
export function placeOnStaff(midi: number, clef: Clef): Placement {
  checkKey(midi);
  const step = diatonicIndex(midi) - BOTTOM_LINE[clef];
  const spelling = SPELLING[midi % 12];
  return {
    midi,
    clef,
    vexKey: `${spelling}/${octaveOf(midi)}`,
    accidental: spelling.endsWith('#') ? '#' : null,
    step,
    ledgerLines: ledgerLinesFor(step),
  };
}

/** How many steps a key lies outside the five lines; 0 while it is on them. */
export function stepsOutsideStaff(midi: number, clef: Clef): number {
  const { step } = placeOnStaff(midi, clef);
  return Math.max(0, -step, step - TOP_LINE);
}

/**
 * Whether both clefs write the key equally near the five lines.
 *
 * In the exercise range that is the middle C position only — Do4 and the black
 * key on it — where the treble writing wants one ledger line below the staff
 * and the bass writing one above it. The map makes those alternate.
 */
export function equallyNearInBothClefs(midi: number): boolean {
  return stepsOutsideStaff(midi, 'treble') === stepsOutsideStaff(midi, 'bass');
}

/**
 * The key as the exercise draws it: in the clef that keeps it nearest the
 * staff.
 *
 * `lastClef` is the clef the previous target was written in. Only a key that
 * both clefs write equally near looks at it, and it takes the other clef, so
 * that successive targets through the middle C show both writings.
 */
export function nearestPlacement(midi: number, lastClef?: Clef): Placement {
  const inTreble = stepsOutsideStaff(midi, 'treble');
  const inBass = stepsOutsideStaff(midi, 'bass');
  if (inTreble !== inBass) return placeOnStaff(midi, inTreble < inBass ? 'treble' : 'bass');
  return placeOnStaff(midi, lastClef === 'treble' ? 'bass' : 'treble');
}

/** Whether a key belongs to a range; the range includes both its ends. */
export function isInRange(midi: number, range: KeyRange): boolean {
  return Number.isInteger(midi) && midi >= range.lowest && midi <= range.highest;
}

/** Every key of a range, lowest first: what a session may ask for. */
export function keysInRange(range: KeyRange): number[] {
  const keys: number[] = [];
  for (let midi = range.lowest; midi <= range.highest; midi++) keys.push(midi);
  return keys;
}
