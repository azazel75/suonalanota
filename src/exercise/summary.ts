/**
 * :Project:  suona-la-nota -- what the session leaves behind
 * :Created:  dom 08 nov 2026 23:40:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The numbers and the notes of a session that is over. The three verdicts stay
 * apart — wrong means the allievə tried and missed, skipped means nobody tried —
 * and the notes to look at again are **written on the staff**, in the clef they
 * were asked in, because a ten-year-old reads the staff and not the word "Do4".
 *
 * No DOM: this decides what the summary says, the page decides how it looks.
 */
import { midiToItalian } from '../audio/notes';
import { nearestPlacement, placeOnStaff, type Clef, type Placement } from '../score/staff';
import type { EndReason, SessionState } from '../session/engine';

/** A note of the summary, drawn as the allievə saw it. */
export interface SummaryNote {
  readonly key: number;
  /** Italian name, for the screen reader: the eye reads the staff. */
  readonly name: string;
  readonly placement: Placement;
}

/**
 * The notes of one clef, in the order they were asked: they go on one staff,
 * one after the other, which is what makes the summary short.
 */
export interface SummarySeries {
  readonly clef: Clef;
  readonly notes: readonly SummaryNote[];
}

export interface SessionSummary {
  readonly centered: number;
  readonly wrong: number;
  readonly skipped: number;
  /** Closed targets: always the sum of the three counts. */
  readonly total: number;
  /** Notes per minute, written the Italian way: `8,5`. */
  readonly notesPerMinute: string;
  readonly reason: EndReason | null;
  /** The keys closed as wrong, once each, grouped by the clef they were drawn in. */
  readonly wrongNotes: readonly SummarySeries[];
  /** The keys nobody tried, once each, grouped the same way. */
  readonly skippedNotes: readonly SummarySeries[];
}

/** One decimal, Italian comma: the number a teacher reads aloud. */
const RATE = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

/**
 * The summary of a session: counts, rate, and the notes to look at again.
 *
 * `clefs` is the clef each key was actually written in during the session —
 * only the middle C can be written two ways, and showing it on the other staff
 * would be a different note from the one the allievə saw.
 */
export function summarise(
  state: SessionState,
  clefs: ReadonlyMap<number, Clef> = new Map(),
): SessionSummary {
  const wrongNotes: SummaryNote[] = [];
  const skippedNotes: SummaryNote[] = [];
  const seenWrong = new Set<number>();
  const seenSkipped = new Set<number>();

  function note(key: number): SummaryNote {
    const clef = clefs.get(key) ?? nearestPlacement(key).clef;
    return { key, name: midiToItalian(key), placement: placeOnStaff(key, clef) };
  }

  for (const target of state.results) {
    if (target.verdict === 'wrong' && !seenWrong.has(target.key)) {
      seenWrong.add(target.key);
      wrongNotes.push(note(target.key));
    }
    if (target.verdict === 'skipped' && !seenSkipped.has(target.key)) {
      seenSkipped.add(target.key);
      skippedNotes.push(note(target.key));
    }
  }

  return {
    centered: state.score.centered,
    wrong: state.score.wrong,
    skipped: state.score.skipped,
    total: state.score.total,
    notesPerMinute: RATE.format(state.score.notesPerMinute),
    reason: state.endReason,
    wrongNotes: byClef(wrongNotes),
    skippedNotes: byClef(skippedNotes),
  };
}

/**
 * The notes of one clef together, treble first: the two readings are two
 * staves, and the order inside each is the order they were asked in.
 */
function byClef(notes: readonly SummaryNote[]): SummarySeries[] {
  const order: Clef[] = ['treble', 'bass'];
  return order
    .map((clef) => ({ clef, notes: notes.filter((note) => note.placement.clef === clef) }))
    .filter((series) => series.notes.length > 0);
}
