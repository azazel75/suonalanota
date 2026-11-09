/**
 * :Project:  suona-la-nota -- the key-to-staff table, checked row by row
 * :Created:  dom 08 nov 2026 22:12:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The map decides where the target is drawn, and a wrong row is a wrong note
 * in front of a ten-year-old: so this test knows the answer for every key of
 * the exercise range, instead of asking the map to confirm itself. The rows
 * were cross-checked against VexFlow, which puts a key at `line = (step + 2)/2`
 * in each clef, and against the ledger lines the library draws.
 */
import { expect, test } from 'vitest';

import { midiToItalian } from '../src/audio/notes';
import { LINE_SPACING, SHEET_HEIGHT, fitsSheet, outerInk, topLineY, yOfStep } from '../src/score/layout';
import {
  ADVANCED_RANGE,
  BASE_RANGE,
  equallyNearInBothClefs,
  isInRange,
  keysInRange,
  nearestPlacement,
  placeOnStaff,
  stepsOutsideStaff,
} from '../src/score/staff';
import type { Clef } from '../src/score/staff';

/**
 * One row per key: MIDI number, Italian name, clef, step above the bottom line
 * (0 is the first line, 8 the fifth) and the ledger lines that position needs,
 * as step indexes, negative below the staff.
 *
 * The two rows of the middle C position — Do4 and the black key on it — show
 * the treble writing only: the other one is a separate case, tested apart.
 */
type Row = readonly [number, string, Clef, number, readonly number[]];

const TABLE: readonly Row[] = [
  [35, 'Si1', 'bass', -5, [-2, -4]],
  [36, 'Do2', 'bass', -4, [-2, -4]],
  [37, 'Do♯2', 'bass', -4, [-2, -4]],
  [38, 'Re2', 'bass', -3, [-2]],
  [39, 'Re♯2', 'bass', -3, [-2]],
  [40, 'Mi2', 'bass', -2, [-2]],
  [41, 'Fa2', 'bass', -1, []],
  [42, 'Fa♯2', 'bass', -1, []],
  [43, 'Sol2', 'bass', 0, []],
  [44, 'Sol♯2', 'bass', 0, []],
  [45, 'La2', 'bass', 1, []],
  [46, 'La♯2', 'bass', 1, []],
  [47, 'Si2', 'bass', 2, []],
  [48, 'Do3', 'bass', 3, []],
  [49, 'Do♯3', 'bass', 3, []],
  [50, 'Re3', 'bass', 4, []],
  [51, 'Re♯3', 'bass', 4, []],
  [52, 'Mi3', 'bass', 5, []],
  [53, 'Fa3', 'bass', 6, []],
  [54, 'Fa♯3', 'bass', 6, []],
  [55, 'Sol3', 'bass', 7, []],
  [56, 'Sol♯3', 'bass', 7, []],
  [57, 'La3', 'bass', 8, []],
  [58, 'La♯3', 'bass', 8, []],
  [59, 'Si3', 'bass', 9, []],
  [60, 'Do4', 'treble', -2, [-2]],
  [61, 'Do♯4', 'treble', -2, [-2]],
  [62, 'Re4', 'treble', -1, []],
  [63, 'Re♯4', 'treble', -1, []],
  [64, 'Mi4', 'treble', 0, []],
  [65, 'Fa4', 'treble', 1, []],
  [66, 'Fa♯4', 'treble', 1, []],
  [67, 'Sol4', 'treble', 2, []],
  [68, 'Sol♯4', 'treble', 2, []],
  [69, 'La4', 'treble', 3, []],
  [70, 'La♯4', 'treble', 3, []],
  [71, 'Si4', 'treble', 4, []],
  [72, 'Do5', 'treble', 5, []],
  [73, 'Do♯5', 'treble', 5, []],
  [74, 'Re5', 'treble', 6, []],
  [75, 'Re♯5', 'treble', 6, []],
  [76, 'Mi5', 'treble', 7, []],
  [77, 'Fa5', 'treble', 8, []],
  [78, 'Fa♯5', 'treble', 8, []],
  [79, 'Sol5', 'treble', 9, []],
  [80, 'Sol♯5', 'treble', 9, []],
  [81, 'La5', 'treble', 10, [10]],
  [82, 'La♯5', 'treble', 10, [10]],
  [83, 'Si5', 'treble', 11, [10]],
  [84, 'Do6', 'treble', 12, [10, 12]],
  [85, 'Do♯6', 'treble', 12, [10, 12]],
  [86, 'Re6', 'treble', 13, [10, 12]],
];

const MIDDLE_C = 60;
const MIDDLE_C_SHARP = 61;

/** The row the table holds for a key; the tests never invent one. */
function rowFor(midi: number): Row {
  const row = TABLE.find((entry) => entry[0] === midi);
  if (row === undefined) throw new Error(`the table has no row for key ${midi}`);
  return row;
}

test('every key of the advanced range is drawn on the row the table gives', () => {
  for (const row of TABLE) {
    const [midi, name, clef, step, ledgerLines] = row;
    const placement = placeOnStaff(midi, clef);
    expect(midiToItalian(midi), `the name of ${midi}`).toBe(name);
    expect(placement.step, `the step of ${name}`).toBe(step);
    expect(placement.ledgerLines, `the ledger lines of ${name}`).toEqual(ledgerLines);
    expect(placement.accidental, `the accidental of ${name}`).toBe(name.includes('\u266f') ? '#' : null);
    expect(placement.vexKey, `the VexFlow key of ${name}`).toMatch(/^[a-g]#?\/-?\d+$/);
  }
});

test('the table covers both ranges, key after key, and nothing outside them', () => {
  expect(TABLE.map((row) => row[0])).toEqual(keysInRange(ADVANCED_RANGE));
  expect(keysInRange(ADVANCED_RANGE)).toHaveLength(52);
  expect(keysInRange(BASE_RANGE)).toHaveLength(25);
  for (const midi of keysInRange(BASE_RANGE)) expect(rowFor(midi)[0]).toBe(midi);
});

test('the presets are Do3-Do5 and Si1-Re6', () => {
  expect([BASE_RANGE.lowest, BASE_RANGE.highest]).toEqual([48, 72]);
  expect([ADVANCED_RANGE.lowest, ADVANCED_RANGE.highest]).toEqual([35, 86]);
  expect(midiToItalian(BASE_RANGE.lowest)).toBe('Do3');
  expect(midiToItalian(BASE_RANGE.highest)).toBe('Do5');
  expect(midiToItalian(ADVANCED_RANGE.lowest)).toBe('Si1');
  expect(midiToItalian(ADVANCED_RANGE.highest)).toBe('Re6');
});

test('the clef is the one that leaves the note nearest the five lines', () => {
  for (const [midi, name, clef] of TABLE) {
    const here = stepsOutsideStaff(midi, clef);
    const there = stepsOutsideStaff(midi, clef === 'treble' ? 'bass' : 'treble');
    if (equallyNearInBothClefs(midi)) {
      expect(here, `the middle C position of ${name}`).toBe(there);
      continue;
    }
    expect(here, `the chosen clef of ${name}`).toBeLessThan(there);
    expect(nearestPlacement(midi).clef, `the clef of ${name}`).toBe(clef);
  }
});

test('only the middle C position is written equally near in both clefs', () => {
  const tied = TABLE.map((row) => row[0]).filter((midi) => equallyNearInBothClefs(midi));
  expect(tied).toEqual([MIDDLE_C, MIDDLE_C_SHARP]);
});

test('no target of the exercise needs more than two ledger lines', () => {
  const crowded = TABLE.map((row) => [row[1], placeOnStaff(row[0], row[2]).ledgerLines.length] as const)
    .filter(([, count]) => count > 2);
  expect(crowded).toEqual([]);
});

test('the ledger lines start one step outside the staff and stop at the note', () => {
  for (const [midi, name, clef] of TABLE) {
    const { step, ledgerLines } = placeOnStaff(midi, clef);
    if (step >= -1 && step <= 9) {
      // The space just outside the staff needs no line at all.
      expect(ledgerLines, `the space outside the staff of ${name}`).toEqual([]);
      continue;
    }
    expect(ledgerLines[0], `the innermost ledger line of ${name}`).toBe(step < 0 ? -2 : 10);
    const outermost = ledgerLines[ledgerLines.length - 1];
    expect(Math.abs(outermost - step), `the outermost ledger line of ${name}`).toBeLessThanOrEqual(1);
    for (let index = 1; index < ledgerLines.length; index++) {
      expect(ledgerLines[index] - ledgerLines[index - 1], `the spacing of ${name}`).toBe(step < 0 ? -2 : 2);
    }
  }
});

test('the keys carry the spelling VexFlow wants', () => {
  expect(placeOnStaff(35, 'bass').vexKey).toBe('b/1');
  expect(placeOnStaff(48, 'bass').vexKey).toBe('c/3');
  expect(placeOnStaff(60, 'treble').vexKey).toBe('c/4');
  expect(placeOnStaff(MIDDLE_C_SHARP, 'treble').vexKey).toBe('c#/4');
  expect(placeOnStaff(66, 'treble').vexKey).toBe('f#/4');
  expect(placeOnStaff(86, 'treble').vexKey).toBe('d/6');
});

test('the middle C is written in both clefs and alternates between targets', () => {
  const inTreble = placeOnStaff(MIDDLE_C, 'treble');
  const inBass = placeOnStaff(MIDDLE_C, 'bass');
  // One ledger line below the treble staff, one above the bass staff.
  expect([inTreble.step, inTreble.ledgerLines]).toEqual([-2, [-2]]);
  expect([inBass.step, inBass.ledgerLines]).toEqual([10, [10]]);

  const clefs: Clef[] = [];
  let previousClef: Clef | undefined;
  for (let target = 0; target < 4; target++) {
    const placement = nearestPlacement(MIDDLE_C, previousClef);
    clefs.push(placement.clef);
    previousClef = placement.clef;
  }
  expect(clefs).toEqual(['treble', 'bass', 'treble', 'bass']);
  // The black key on the same place ties as well, and alternates the same way.
  expect(nearestPlacement(MIDDLE_C_SHARP, 'treble').clef).toBe('bass');
});

test('a number that is not a key is refused instead of drawn somewhere', () => {
  for (const value of [-1, 128, 60.5, Number.NaN]) {
    expect(() => placeOnStaff(value, 'treble'), `placeOnStaff(${value})`).toThrow(RangeError);
    expect(() => nearestPlacement(value), `nearestPlacement(${value})`).toThrow(RangeError);
  }
});

test('the range decides which keys a session may ask for', () => {
  expect(isInRange(48, BASE_RANGE)).toBe(true);
  expect(isInRange(47, BASE_RANGE)).toBe(false);
  expect(isInRange(72, BASE_RANGE)).toBe(true);
  expect(isInRange(73, BASE_RANGE)).toBe(false);
  expect(isInRange(34, ADVANCED_RANGE)).toBe(false);
  expect(isInRange(35, ADVANCED_RANGE)).toBe(true);
  expect(isInRange(86, ADVANCED_RANGE)).toBe(true);
  expect(isInRange(87, ADVANCED_RANGE)).toBe(false);

  const drawn = keysInRange(BASE_RANGE).map((midi) => nearestPlacement(midi).midi);
  expect(drawn.every((midi) => isInRange(midi, BASE_RANGE))).toBe(true);
});

test('the staff moves so that the target stays whole on the sheet', () => {
  const halfHead = LINE_SPACING / 2;
  for (const [midi, name, clef] of TABLE) {
    const placement = placeOnStaff(midi, clef);
    const topLine = topLineY(placement);
    const noteY = yOfStep(topLine, placement.step);
    expect(noteY - halfHead, `the top of ${name}`).toBeGreaterThanOrEqual(0);
    expect(noteY + halfHead, `the bottom of ${name}`).toBeLessThanOrEqual(SHEET_HEIGHT);
    expect(fitsSheet(placement), `${name} fits the sheet`).toBe(true);
    // The five lines themselves stay inside the drawing as well.
    expect(topLine, `the fifth line of ${name}`).toBeGreaterThanOrEqual(0);
    expect(yOfStep(topLine, 0), `the first line of ${name}`).toBeLessThanOrEqual(SHEET_HEIGHT);
  }
});

test('the drawing is centred on the sheet, with the room the clef asks for', () => {
  for (const [midi, name, clef] of TABLE) {
    const placement = placeOnStaff(midi, clef);
    const topLine = topLineY(placement);
    const { above, below } = outerInk([placement], LINE_SPACING);
    // What the sheet reserves — the notes' ink or the clef's, whichever is
    // taller — is what gets centred, and it has to fit the paper.
    const top = topLine - above;
    const bottom = topLine + 4 * LINE_SPACING + below;
    expect(top + bottom, `the centre of ${name}`).toBeCloseTo(SHEET_HEIGHT, 9);
    expect(top, `the top of ${name}`).toBeGreaterThanOrEqual(-1e-9);
    expect(bottom, `the bottom of ${name}`).toBeLessThanOrEqual(SHEET_HEIGHT + 1e-9);
  }
});
