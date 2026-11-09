/**
 * :Project:  suona-la-nota -- where the staff sits on the sheet
 * :Created:  dom 08 nov 2026 22:30:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The target has to read from a phone: one staff, one note, large. The sheet
 * has a fixed logical size and the page scales the SVG to the width of the
 * screen, so the note keeps the same shape everywhere; the only thing that
 * moves is the height of the staff. It moves so that the ink of the target —
 * note head and ledger lines both — stays centred, which keeps a Do6 with two
 * ledger lines above from touching the edge and a Mi4 from floating in the
 * middle of nothing.
 *
 * It is separate from ./staff because it is pixels, not notation: the map says
 * which step, this says where that step is drawn. Both are pure, so both can
 * be checked without a browser.
 */
import type { Clef, Placement } from './staff';

/** Everything a staff needs to know about the paper it is drawn on. */
export interface SheetGeometry {
  readonly width: number;
  readonly height: number;
  /** Distance between two staff lines. */
  readonly spacing: number;
  /** Empty paper on either side of the staff. */
  readonly margin: number;
}

/** The sheet of the exercise: one target, large, for a phone in a room. */
export const EXERCISE_SHEET: SheetGeometry = { width: 400, height: 300, spacing: 30, margin: 12 };

/**
 * The sheet of a summary: the same staff, small enough that a few of them fit
 * side by side on a phone — a note to look at again, not to read for the first
 * time.
 */
export const SUMMARY_SHEET: SheetGeometry = { width: 180, height: 150, spacing: 22, margin: 6 };

/**
 * How big the glyphs are, in staff spaces.
 *
 * A music font draws one staff space as a quarter of the em — SMuFL, *Metrics and
 * glyph registration*: «All glyphs should be drawn at a scale consistent with the
 * key measurement that one staff space = 0.25 em». VexFlow's glyph font is fixed
 * at 30 pt, which is right for its own spacing of 10 px and a third of the size
 * for a stave of 30: the staff grows and the noteheads do not.
 *
 * So the font is derived from the spacing. The notehead is a glyph of 0.25 em:
 * 4.2 spaces of em draw a head of **1.05 spaces** — a shade fuller than the bare
 * space, which is what a teacher asked for. The G clef is 1.775 em tall: 4 spaces
 * of em draw it **7.1 spaces**, its height in engraved music.
 */
export const NOTEHEAD_EM_SPACES = 4.2;
export const CLEF_EM_SPACES = 4;

/** A glyph font of `emSpaces` staff spaces per em, in VexFlow's points. */
function fontPt(spacing: number, emSpaces: number): number {
  return emSpaces * spacing * 0.75;
}

/** The font of a notehead, accidentals included. */
export function noteheadFontPt(spacing: number): number {
  return fontPt(spacing, NOTEHEAD_EM_SPACES);
}

/** The font of a clef. */
export function clefFontPt(spacing: number): number {
  return fontPt(spacing, CLEF_EM_SPACES);
}

/** Staff lines: a tenth of a space, which is what VexFlow draws at its own 10 px. */
export const LINE_SPACES = 0.1;

/** Ledger lines are a little heavier than the staff: a fifth of a space. */
export const LEDGER_SPACES = 0.2;

/**
 * Where the ink of each clef reaches beyond the five lines, in staff spaces.
 *
 * The G clef is 7.08 spaces tall and its curl sits on the second line from the
 * bottom, so it rises 1.4 spaces above the top line and drops 1.7 below the
 * bottom one. The F clef is 3.64 spaces tall and sits on the fourth line: it
 * stays inside the staff, with a hair above the top line and nothing below.
 * A sheet that counted only the note would cut the treble clef at both ends.
 */
export const CLEF_INK: Readonly<Record<Clef, { readonly above: number; readonly below: number }>> = {
  treble: { above: 1.4, below: 1.7 },
  bass: { above: 0.1, below: 0 },
};

/** The exercise sheet, as the numbers the page scales by. */
export const SHEET_WIDTH = EXERCISE_SHEET.width;
export const SHEET_HEIGHT = EXERCISE_SHEET.height;
export const LINE_SPACING = EXERCISE_SHEET.spacing;
export const STAFF_MARGIN = EXERCISE_SHEET.margin;

/** Step of the fifth line, counting from the bottom one. */
export const TOP_LINE = 8;

/** The y of the top line of the staff, so that the ink of the target is centred. */
export function topLineY(placement: Placement, sheet: SheetGeometry = EXERCISE_SHEET): number {
  return topLineFor([placement], sheet);
}

/** The same, for a staff that carries several notes: the ink of all of them counts. */
export function topLineFor(
  placements: readonly Placement[],
  sheet: SheetGeometry = EXERCISE_SHEET,
): number {
  const { above, below } = outerInk(placements, sheet.spacing);
  const block = above + 4 * sheet.spacing + below;
  // Centred when the paper has room, never so high that the top line leaves it.
  return Math.max(sheet.margin, (sheet.height - block) / 2 + above);
}

/**
 * The shortest a series sheet can be: the staff, the clef's two overhangs, the
 * margins and one space of air. A height computed from the notes alone would cut
 * the clef, which is drawn on every sheet.
 */
export function seriesMinHeight(spacing: number, margin: number, clef: Clef = 'treble'): number {
  const ink = CLEF_INK[clef];
  return 4 * spacing + (ink.above + ink.below) * spacing + 2 * margin;
}

/**
 * The sheet a series of notes needs: wide enough for the notes it carries,
 * tall enough that neither a ledger line nor the clef is cut, and one width for
 * all the series of a summary, so their notes are drawn at the same size.
 */
export function seriesSheet(
  placements: readonly Placement[],
  base: SheetGeometry = SUMMARY_SHEET,
): SheetGeometry {
  const { above, below } = outerInk(placements, base.spacing);
  const width = Math.min(900, Math.max(420, 120 + Math.max(1, placements.length) * 70));
  // The staff itself, the ink above and below it, the margins, and one space of
  // air: less than this and a low note would be drawn past the bottom edge.
  const height = Math.max(
    base.margin * 2 + 4 * base.spacing + above + below + base.spacing,
    seriesMinHeight(base.spacing, base.margin, placements[0]?.clef ?? 'treble'),
  );
  return { ...base, width, height };
}

/**
 * How far the ink of these notes reaches beyond the five lines, in pixels: the
 * notes' own ink, or the clef's, whichever asks for more.
 */
export function outerInk(
  placements: readonly Placement[],
  spacing: number,
): { above: number; below: number } {
  const steps = placements.flatMap((placement) => [placement.step, ...placement.ledgerLines]);
  const highest = Math.max(TOP_LINE, ...steps);
  const lowest = Math.min(0, ...steps);
  // The clef is drawn on every sheet, and it can be taller than the staff: its
  // room counts even when the note itself is well inside the lines.
  const clefAbove = Math.max(...placements.map((placement) => CLEF_INK[placement.clef].above));
  const clefBelow = Math.max(...placements.map((placement) => CLEF_INK[placement.clef].below));
  return {
    above: Math.max(((highest - TOP_LINE) * spacing) / 2, clefAbove * spacing),
    below: Math.max(((0 - lowest) * spacing) / 2, clefBelow * spacing),
  };
}

/** The y of a step, given the y of the top line of its staff. */
export function yOfStep(topLine: number, step: number, spacing: number = LINE_SPACING): number {
  return topLine + ((TOP_LINE - step) * spacing) / 2;
}

/**
 * Whether the whole target fits the sheet, note head included.
 *
 * The head is about one space tall, so half a space of margin on each side is
 * what "not cut off" means here.
 */
export function fitsSheet(placement: Placement, sheet: SheetGeometry = EXERCISE_SHEET): boolean {
  const topLine = topLineY(placement, sheet);
  const ys = [
    yOfStep(topLine, placement.step, sheet.spacing),
    ...placement.ledgerLines.map((line) => yOfStep(topLine, line, sheet.spacing)),
  ];
  const halfHead = sheet.spacing / 2;
  return Math.min(...ys) - halfHead >= 0 && Math.max(...ys) + halfHead <= sheet.height;
}
