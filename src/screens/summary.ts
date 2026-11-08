/**
 * :Project:  suona-la-nota -- the screen that reads a session back
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The summary: three counts, the notes per minute, the notes to look at again
 * on the staff, and the log of the session.
 *
 * The log is built once, here, when the session ends and from the state the
 * summary is showing — after that instant the page forgets the session, and the
 * file is all that is left of it. Even a session that closed no bersaglio has a
 * log: the settings in force and the score are evidence too, and "no log at
 * all" would be the one answer a teacher cannot read (docs/adr/0012).
 */
import type { Settings } from '../exercise/settings';
import { summarise, type SummarySeries } from '../exercise/summary';
import { seriesSheet } from '../score/layout';
import { drawNotes } from '../score/sheet';
import type { Clef } from '../score/staff';
import type { EndReason, SessionState } from '../session/engine';
import { logFileName, logJson, sessionLog, type TargetLog } from '../session/log';
import { element, saveFile } from '../ui/dom';
import { count } from '../ui/text';
import type { ScreenName } from './screen-name';
import type { Wizard } from './wizard';

/** What a finished session leaves for this screen: the counts, and the evidence the log is made of. */
export interface SessionResult {
  readonly reason: EndReason;
  readonly state: SessionState;
  /** The trial in force, kept for the log: the controls may have moved since. */
  readonly settings: Settings;
  /** The clef each key was drawn in: the middle C can be written two ways. */
  readonly clefs: ReadonlyMap<number, Clef>;
  /** The bersagli the session asked, each with the colpi heard while it was on screen. */
  readonly targets: readonly TargetLog[];
}

/** What the page asks of this screen, and nothing more. */
export interface SummaryScreen {
  /** Shows the session that just ended. */
  show(result: SessionResult): void;
  /** The log on screen is not the log of the next session. */
  clear(): void;
}

/** What this screen needs from the rest of the page. */
export interface SummaryPorts {
  readonly wizard: Wizard<ScreenName>;
  /** "Torna all'inizio": back to the configuration, without reloading the page. */
  readonly restart: () => void;
}

/**
 * One staff per clef, the notes one after the other: two lines instead of one
 * card per note, and the writing the allievo saw preserved. Each staff gets the
 * sheet its own notes need, so the ink is never cut and the notes stay as large
 * as the room allows.
 */
function fillSeries(host: HTMLDivElement, series: readonly SummarySeries[]): void {
  host.replaceChildren();
  for (const group of series) {
    const placements = group.notes.map((note) => note.placement);
    const card = document.createElement('div');
    card.className = 'mini sheet';
    card.setAttribute('role', 'img');
    // The eye reads the staff; the names are for the screen reader.
    card.setAttribute('aria-label', group.notes.map((note) => note.name).join(', '));
    host.append(card);
    drawNotes(card, placements, seriesSheet(placements));
  }
}

export function createSummaryScreen(ports: SummaryPorts): SummaryScreen {
  const summaryReason = element<HTMLParagraphElement>('summary-reason');
  const summaryScore = element<HTMLParagraphElement>('summary-score');
  const summaryRate = element<HTMLParagraphElement>('summary-rate');
  const wrongGroup = element<HTMLElement>('wrong-group');
  const wrongNotes = element<HTMLDivElement>('wrong-notes');
  const skippedGroup = element<HTMLElement>('skipped-group');
  const skippedNotes = element<HTMLDivElement>('skipped-notes');
  const logGroup = element<HTMLElement>('log-group');
  const logButton = element<HTMLButtonElement>('log');
  const restartButton = element<HTMLButtonElement>('restart');

  /** The file the summary hands over, built the once, when the session ends. */
  let downloadable: { readonly name: string; readonly text: string } | null = null;

  function downloadLog(): void {
    if (downloadable === null) return;
    saveFile(downloadable.name, downloadable.text, 'application/json');
  }

  function show(result: SessionResult): void {
    const summary = summarise(result.state, result.clefs);
    summaryReason.textContent =
      result.reason === 'duration' ? 'È scaduto il tempo.' : 'La lista dei bersagli è finita.';
    summaryScore.textContent = [
      count(summary.centered, 'corretta', 'corrette'),
      count(summary.wrong, 'sbagliata', 'sbagliate'),
      count(summary.skipped, 'saltata', 'saltate'),
      `${summary.total} in tutto`,
    ].join(' · ');
    // "1 nota al minuto" but "4,5 note al minuto": the same agreement as the counts.
    summaryRate.textContent = `${summary.notesPerMinute} ${
      summary.notesPerMinute === '1' ? 'nota' : 'note'
    } al minuto`;

    fillSeries(wrongNotes, summary.wrongNotes);
    fillSeries(skippedNotes, summary.skippedNotes);
    // An empty list says nothing: no heading, no empty row.
    wrongGroup.hidden = summary.wrongNotes.length === 0;
    skippedGroup.hidden = summary.skippedNotes.length === 0;

    const when = new Date();
    downloadable = {
      name: logFileName(when),
      text: logJson(
        sessionLog({ when, settings: result.settings, state: result.state, targets: result.targets }),
      ),
    };
    logGroup.hidden = false;

    ports.wizard.show('summary');
  }

  function clear(): void {
    downloadable = null;
    logGroup.hidden = true;
  }

  logButton.addEventListener('click', downloadLog);
  restartButton.addEventListener('click', ports.restart);

  return { show, clear };
}
