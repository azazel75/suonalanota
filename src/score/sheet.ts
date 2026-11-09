/**
 * :Project:  suona-la-nota -- notes on a staff, and nothing else
 * :Created:  dom 08 nov 2026 22:35:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The drawing half of the screens: take placements from ./staff, put them on a
 * staff of ./layout, and nothing else. No time signature, no bar lines, no name
 * of the note: on the exercise staff the target is the whole question, and on
 * the summary the notes are the ones to look at again.
 *
 * Two shapes, one machinery: a single note, large and centred, and a series of
 * notes in the same clef, one after the other.
 *
 * A whole note, not a half one: a VexFlow voice refuses to be drawn unless its
 * ticks fill the measure, and both screens show no rhythm to read.
 */
/*
 * Import from `vexflow/bravura`, not from `vexflow`: the full entry loads six
 * font families (Gonville, Petaluma...) that this page never uses, and in a PWA
 * aimed at a phone 300 kB of extra gzip is not a detail.
 */
import { Accidental, Formatter, Renderer, Stave, StaveModifierPosition, StaveNote, Voice } from 'vexflow/bravura';

import {
  clefFontPt,
  EXERCISE_SHEET,
  LEDGER_SPACES,
  LINE_SPACES,
  noteheadFontPt,
  topLineFor,
  type SheetGeometry,
} from './layout';
import type { Placement } from './staff';

/** Draw the target, and nothing else, in the given host. */
export function drawTarget(
  host: HTMLDivElement,
  placement: Placement,
  sheet: SheetGeometry = EXERCISE_SHEET,
): void {
  draw(host, [placement], sheet, true, false);
}

/**
 * Draw a series of notes in one clef, one after the other, in the order given:
 * the notes of a summary, which are read as a line and not one by one. The
 * sheet never grows past its logical size, so two notes and five notes are
 * drawn at the same scale.
 */
export function drawNotes(
  host: HTMLDivElement,
  placements: readonly Placement[],
  sheet: SheetGeometry,
): void {
  draw(host, placements, sheet, false, true);
}

function draw(
  host: HTMLDivElement,
  placements: readonly Placement[],
  sheet: SheetGeometry,
  centreLoneNote: boolean,
  capWidth: boolean,
): void {
  // A fresh renderer each time: resize() would keep the previous drawing.
  host.replaceChildren();
  host.classList.remove('bad');
  if (placements.length === 0) return;

  try {
    const clef = placements[0].clef;
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(sheet.width, sheet.height);
    const context = renderer.getContext();

    const stave = new Stave(sheet.margin, topLineFor(placements, sheet), sheet.width - 2 * sheet.margin, {
      spaceAboveStaffLn: 0,
      spaceBelowStaffLn: 0,
      spacingBetweenLinesPx: sheet.spacing,
      leftBar: false,
      rightBar: false,
    });
    stave.addClef(clef);
    // VexFlow draws every glyph with one fixed font, calibrated on its own staff
    // spacing of 10 px. This stave is not 10 px: the clef, the noteheads and the
    // accidentals have to be told the size the space actually has, or they come
    // out a third of it. The lines are absolute too, and get the same treatment.
    for (const modifier of stave.getModifiers(StaveModifierPosition.BEGIN)) {
      if (modifier.getCategory() === 'Clef') modifier.setFontSize(clefFontPt(sheet.spacing));
    }
    stave.setStyle({ lineWidth: sheet.spacing * LINE_SPACES });
    stave.setDefaultLedgerLineStyle({ strokeStyle: '#444', lineWidth: sheet.spacing * LEDGER_SPACES });

    const glyphPt = noteheadFontPt(sheet.spacing);
    const notes = placements.map((placement) => {
      const note = new StaveNote({ keys: [placement.vexKey], duration: 'w', clef });
      // The noteheads are built in the constructor, with the font the note had
      // then: set the size and build them again.
      note.setFontSize(glyphPt);
      note.buildNoteHeads();
      if (placement.accidental !== null) {
        const accidental = new Accidental(placement.accidental);
        accidental.setFontSize(glyphPt);
        note.addModifier(accidental, 0);
      }
      return note;
    });

    // A voice that does not have to fill the measure: the exercise shows one
    // note, the summary shows them in a row, evenly spaced across the staff.
    const voice = new Voice({ numBeats: notes.length * 4, beatValue: 4 })
      .setStrict(false)
      .addTickables(notes);
    new Formatter().joinVoices([voice]).formatToStave([voice], stave);

    if (centreLoneNote && notes.length === 1) {
      // The formatter leaves a lone note at the start of the measure; the target
      // reads better in the middle of an otherwise empty staff.
      const centre = (stave.getNoteStartX() + stave.getNoteEndX()) / 2;
      notes[0].getTickContext().setX(centre - notes[0].getGlyphWidth() / 2);
    }

    // VexFlow's stave reads its style only to nudge an odd width to the half
    // pixel: the stroke itself comes from the context, which is why the width is
    // set here and put back before the notes (whose ledger lines carry their own).
    const staveLineWidth = sheet.spacing * LINE_SPACES;
    context.setLineWidth(staveLineWidth);
    stave.setContext(context).draw();
    context.setLineWidth(1);
    voice.draw(context, stave);
    fitToWidth(host, sheet, capWidth);
  } catch (error) {
    // The page is the smoke test: a silent empty staff would be the worst
    // possible outcome, so the failure is printed where the staff should be.
    host.textContent = `VexFlow non ha disegnato: ${String(error)}`;
    host.classList.add('bad');
  }
}

/**
 * Let the sheet scale to its card.
 *
 * Last, because the drawing writes `width` back as an inline style: left alone,
 * the staff keeps its logical size and overflows the card on a phone. The
 * viewBox is what keeps the proportions while the paper shrinks.
 */
function fitToWidth(host: HTMLDivElement, sheet: SheetGeometry, capWidth: boolean): void {
  const svg = host.querySelector('svg');
  if (svg === null) return;
  if (!svg.hasAttribute('viewBox')) {
    svg.setAttribute('viewBox', `0 0 ${sheet.width} ${sheet.height}`);
  }
  svg.style.width = '100%';
  svg.style.height = 'auto';
  // A short series must not be blown up past the size its notes were drawn at,
  // or two series side by side would show notes of two different sizes.
  svg.style.maxWidth = capWidth ? `${sheet.width}px` : '';
}
