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
import type { Placement } from './staff';

/** Logical size of the drawing; index.html scales the SVG to the width of the screen. */
export const SHEET_WIDTH = 400;
export const SHEET_HEIGHT = 300;

/** Distance between two staff lines: large enough for a phone in a room. */
export const LINE_SPACING = 30;

export const STAFF_MARGIN = 12;

/** Step of the fifth line, counting from the bottom one. */
export const TOP_LINE = 8;

/** The topmost ink of a target: the fifth line, unless a ledger goes higher. */
function highestInk(placement: Placement): number {
  return Math.max(TOP_LINE, placement.step, ...placement.ledgerLines);
}

/** The bottommost ink: the first line, unless a ledger goes lower. */
function lowestInk(placement: Placement): number {
  return Math.min(0, placement.step, ...placement.ledgerLines);
}

/** The y of the top line of the staff, so that the ink of the target is centred. */
export function topLineY(placement: Placement): number {
  const ink = ((highestInk(placement) - lowestInk(placement)) * LINE_SPACING) / 2;
  return (SHEET_HEIGHT - ink) / 2 + ((highestInk(placement) - TOP_LINE) * LINE_SPACING) / 2;
}

/** The y of a step, given the y of the top line of its staff. */
export function yOfStep(topLine: number, step: number): number {
  return topLine + ((TOP_LINE - step) * LINE_SPACING) / 2;
}

/**
 * Whether the whole target fits the sheet, note head included.
 *
 * The head is about one space tall, so half a space of margin on each side is
 * what "not cut off" means here.
 */
export function fitsSheet(placement: Placement): boolean {
  const topLine = topLineY(placement);
  const top = Math.min(yOfStep(topLine, placement.step), ...placement.ledgerLines.map((line) => yOfStep(topLine, line)));
  const bottom = Math.max(yOfStep(topLine, placement.step), ...placement.ledgerLines.map((line) => yOfStep(topLine, line)));
  const halfHead = LINE_SPACING / 2;
  return top - halfHead >= 0 && bottom + halfHead <= SHEET_HEIGHT;
}
