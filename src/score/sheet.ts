/**
 * :Project:  suona-la-nota -- one target, drawn on one staff
 * :Created:  dom 08 nov 2026 22:35:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The drawing half of the exercise screen: take a placement from ./staff, put
 * it on a staff of ./layout, and nothing else. No time signature, no bar lines,
 * no name of the note: on this staff the target is the whole question.
 *
 * A whole note, not a half one: a VexFlow voice refuses to be drawn unless its
 * ticks fill the measure, and the exercise shows one note per measure anyway.
 */
/*
 * Import from `vexflow/bravura`, not from `vexflow`: the full entry loads six
 * font families (Gonville, Petaluma...) that this page never uses, and in a PWA
 * aimed at a phone 300 kB of extra gzip is not a detail.
 */
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow/bravura';

import { LINE_SPACING, SHEET_HEIGHT, SHEET_WIDTH, STAFF_MARGIN, topLineY } from './layout';
import type { Placement } from './staff';

/** Draw the target, and nothing else, in the given host. */
export function drawTarget(host: HTMLDivElement, placement: Placement): void {
  // A fresh renderer each time: resize() would keep the previous drawing.
  host.replaceChildren();
  host.classList.remove('bad');

  try {
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(SHEET_WIDTH, SHEET_HEIGHT);
    const context = renderer.getContext();

    const stave = new Stave(STAFF_MARGIN, topLineY(placement), SHEET_WIDTH - 2 * STAFF_MARGIN, {
      spaceAboveStaffLn: 0,
      spaceBelowStaffLn: 0,
      spacingBetweenLinesPx: LINE_SPACING,
      leftBar: false,
      rightBar: false,
    });
    stave.addClef(placement.clef);

    const note = new StaveNote({
      keys: [placement.vexKey],
      duration: 'w',
      clef: placement.clef,
    });
    if (placement.accidental !== null) note.addModifier(new Accidental(placement.accidental), 0);

    const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false).addTickables([note]);
    new Formatter().joinVoices([voice]).formatToStave([voice], stave);

    // The formatter leaves a lone note at the start of the measure; the target
    // reads better in the middle of an otherwise empty staff.
    const centre = (stave.getNoteStartX() + stave.getNoteEndX()) / 2;
    note.getTickContext().setX(centre - note.getGlyphWidth() / 2);

    stave.setContext(context).draw();
    voice.draw(context, stave);
  } catch (error) {
    // The page is the smoke test: a silent empty staff would be the worst
    // possible outcome, so the failure is printed where the staff should be.
    host.textContent = `VexFlow non ha disegnato: ${String(error)}`;
    host.classList.add('bad');
  }
}
