/**
 * :Project:  suona-la-nota -- the sizes of the staff, in staff spaces
 * :Created:  lun 09 nov 2026 04:20:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The sheet is measured in staff spaces, and so are the glyphs: SMuFL draws one
 * space as a quarter of the em, VexFlow draws its glyphs at a fixed font. These
 * tests keep the two tied together — a staff that grows and noteheads that do
 * not is exactly the defect a teacher saw — and keep the clef inside the paper.
 */
import { describe, expect, it } from 'vitest';

import {
  CLEF_INK,
  EXERCISE_SHEET,
  SUMMARY_SHEET,
  TOP_LINE,
  clefFontPt,
  noteheadFontPt,
  seriesMinHeight,
  seriesSheet,
  topLineFor,
} from '../src/score/layout';
import { nearestPlacement, placeOnStaff, type Placement } from '../src/score/staff';

/** Every key the two ranges ask for, in the clef the app would draw it in. */
function everyPlacement(): readonly Placement[] {
  const placements: Placement[] = [];
  for (const [lowest, highest] of [
    [48, 72],
    [35, 86],
  ]) {
    for (let midi = lowest; midi <= highest; midi++) placements.push(nearestPlacement(midi));
  }
  return placements;
}

describe('the size of the glyphs', () => {
  it('draws the clef at VexFlow’s own size when the space is VexFlow’s own 10 px', () => {
    // VexFlow's default glyph font is 30 pt and its default staff spacing is 10:
    // at that spacing the library is right, and so must we be.
    expect(clefFontPt(10)).toBeCloseTo(30, 6);
  });

  it('scales the font with the space, not with the paper', () => {
    expect(clefFontPt(30)).toBeCloseTo(3 * clefFontPt(10), 6);
    expect(noteheadFontPt(22) / noteheadFontPt(11)).toBeCloseTo(2, 6);
  });

  it('draws the notehead a twentieth fuller than its space', () => {
    // 4.2 spaces of em and a head of 0.25 em: 1.05 spaces tall.
    expect(noteheadFontPt(10) / clefFontPt(10)).toBeCloseTo(1.05, 6);
  });
});

describe('the room the clef needs', () => {
  it('keeps the clef inside the exercise sheet for every key of both ranges', () => {
    for (const placement of everyPlacement()) {
      const ink = CLEF_INK[placement.clef];
      const topLine = topLineFor([placement], EXERCISE_SHEET);
      expect(topLine - ink.above * EXERCISE_SHEET.spacing).toBeGreaterThanOrEqual(-1e-9);
      expect(topLine + 4 * EXERCISE_SHEET.spacing + ink.below * EXERCISE_SHEET.spacing).toBeLessThanOrEqual(
        EXERCISE_SHEET.height + 1e-9,
      );
    }
  });

  it('gives a series sheet the clef’s height even when the notes are inside the lines', () => {
    const middle = [placeOnStaff(60, 'treble'), placeOnStaff(64, 'treble')];
    const sheet = seriesSheet(middle);
    // 4 spaces of staff, the clef's two overhangs, the margins and one space of air.
    const least = seriesMinHeight(SUMMARY_SHEET.spacing, SUMMARY_SHEET.margin, 'treble');
    expect(sheet.height).toBeGreaterThanOrEqual(least);
    const topLine = topLineFor(middle, sheet);
    const ink = CLEF_INK.treble;
    expect(topLine - ink.above * sheet.spacing).toBeGreaterThanOrEqual(-1e-9);
    expect(topLine + 4 * sheet.spacing + ink.below * sheet.spacing).toBeLessThanOrEqual(sheet.height + 1e-9);
  });

  it('asks no overhang for a bass clef, which sits inside the staff', () => {
    // The F clef is 3.64 spaces tall on the fourth line: it does not leave the staff.
    expect(CLEF_INK.bass.below).toBe(0);
    expect(CLEF_INK.bass.above).toBeLessThan(0.5);
  });

  it('still lets a high note push the staff down when there is more ink above than clef', () => {
    const high = placeOnStaff(86, 'treble');
    const sheet = seriesSheet([high]);
    const topLine = topLineFor([high], sheet);
    const above = ((Math.max(TOP_LINE, high.step, ...high.ledgerLines) - TOP_LINE) * sheet.spacing) / 2;
    expect(above).toBeGreaterThan(CLEF_INK[high.clef].above * sheet.spacing);
    expect(topLine - above).toBeGreaterThanOrEqual(-1e-9);
  });
});
