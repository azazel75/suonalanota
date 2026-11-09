/**
 * :Project:  suona-la-nota -- the screen that reads a session back
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The summary: three counts, the notes per minute, the notes to look at again
 * on the staff, the log of the session, and the classifica of the trial in
 * force.
 *
 * The log is built once, here, when the session ends and from the state the
 * summary is showing — after that instant the page forgets the session, and the
 * file is all that is left of it. Even a session that closed no bersaglio has a
 * log: the settings in force and the score are evidence too, and "no log at
 * all" would be the one answer a teacher cannot read (docs/adr/0012).
 *
 * The name is asked at the end, because the score comes first and the classifica
 * is a thing about the ragazzə and not about the exercise. The field opens with
 * the name of the last run, so the usual gesture is a confirmation; the run is
 * written to the board only when that confirmation arrives, so no row appears
 * under a name nobody gave. Which board, and what a row keeps, is decided in
 * `score/leaderboard`; this screen only draws it, marks the player's own row,
 * and shows the place even when it is below the top — a place nobody can see is
 * a place the allievə has to ask an adult about.
 */
import type { Settings } from '../exercise/settings';
import { effectiveRange, type Portata } from '../exercise/portata';
import { summarise, type SummarySeries } from '../exercise/summary';
import {
  NAME_MAX_LENGTH,
  TOP_ROWS,
  cleanName,
  freeName,
  loadBoard,
  loadLastName,
  recordRun,
  resolveName,
  saveBoard,
  saveLastName,
  standings,
  type RankedRow,
  type ScoreEntry,
} from '../score/leaderboard';
import { seriesSheet } from '../score/layout';
import { drawNotes } from '../score/sheet';
import type { Clef } from '../score/staff';
import type { EndReason, SessionState } from '../session/engine';
import { logFileName, logJson, sessionLog, type TargetLog } from '../session/log';
import { browserStorage, element, saveFile } from '../ui/dom';
import { count } from '../ui/text';
import type { ScreenName } from './screen-name';
import type { Wizard } from './wizard';

/** What a finished session leaves for this screen: the counts, and the evidence the log is made of. */
export interface SessionResult {
  readonly reason: EndReason;
  readonly state: SessionState;
  /** The trial in force, kept for the log: the controls may have moved since. */
  readonly settings: Settings;
  /** The portata in force when the session started: the log says whether it was measured. */
  readonly portata: Portata | null;
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

/** The two numbers a run puts on the board, and when it ended. */
interface RunFacts {
  readonly corrette: number;
  readonly notePerMinute: number;
  readonly when: number;
}

/** One decimal, Italian comma: the rate in a row, as the summary writes it. */
const RATE = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

/**
 * One staff per clef, the notes one after the other: two lines instead of one
 * card per note, and the writing the allievə saw preserved. Each staff gets the
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

/** A row of the classifica: the place, the name, and the two numbers it ranks by. */
function boardRow(row: RankedRow): HTMLLIElement {
  const item = document.createElement('li');
  if (row.self) item.className = 'me';

  const place = document.createElement('span');
  place.className = 'place';
  place.textContent = `${row.place}°`;

  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = row.self ? `${row.name} (tu)` : row.name;

  const rate = RATE.format(row.notePerMinute);
  const corrette = count(row.corrette, 'corretta', 'corrette');
  const rateText = `${count(rate, 'nota', 'note')} al minuto`;
  const what = document.createElement('span');
  what.className = 'what';
  what.textContent = `${corrette} · ${rateText}`;

  // The row is three spans and the middle dot; read aloud they would run into
  // one word, so the row says itself in a sentence.
  item.setAttribute('aria-label', `${row.place}° posto: ${who.textContent}, ${corrette}, ${rateText}`);

  item.append(place, who, what);
  return item;
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
  const boardGroup = element<HTMLElement>('board-group');
  const boardList = element<HTMLOListElement>('board');
  const boardEmpty = element<HTMLParagraphElement>('board-empty');
  const boardPlace = element<HTMLParagraphElement>('board-place');
  const nameForm = element<HTMLFormElement>('name-form');
  const nameInput = element<HTMLInputElement>('player-name');

  /** The file the summary hands over, built the once, when the session ends. */
  let downloadable: { readonly name: string; readonly text: string } | null = null;

  /** The trial whose classifica is on screen, and what the session just played. */
  let trial: Settings | null = null;
  let run: RunFacts | null = null;
  /** The board of the trial in force, one row per name, as it is stored. */
  let board: readonly ScoreEntry[] = [];
  /** The name this session was saved under, once it has been. */
  let savedAs: string | null = null;

  function downloadLog(): void {
    if (downloadable === null) return;
    saveFile(downloadable.name, downloadable.text, 'application/json');
  }

  /**
   * The board as the trial in force has it: the first few rows, and the player's
   * own row when it fell below them. `name` is `null` until the run is saved,
   * because until then there is no row of ours to mark.
   */
  function paintBoard(name: string | null): void {
    const seen = standings(board, name, TOP_ROWS);
    boardList.replaceChildren(...seen.rows.map(boardRow));
    boardList.hidden = seen.rows.length === 0;
    boardEmpty.hidden = seen.rows.length > 0;
    boardPlace.hidden = seen.place === null;
    boardPlace.textContent =
      seen.place === null
        ? ''
        : `Sei ${seen.place}° su ${count(seen.total, 'ragazzə', 'ragazzə')} per questa prova.`;
  }

  /**
   * The name was confirmed: the run goes on the board of the trial, the board
   * goes to the phone, and the field goes away. One run, one row — a second
   * confirmation would count the same session twice under two names.
   */
  function saveRun(event: SubmitEvent): void {
    event.preventDefault();
    if (trial === null || run === null || savedAs !== null) return;

    const storage = browserStorage();
    // Only a name the player actually typed is worth remembering. A run that
    // fell back to `utenteN` must not fill the field next time: the next blank
    // run would merge into that same row, and `utente1` would be the only
    // fallback the phone ever hands out.
    const typed = cleanName(nameInput.value);
    const name = resolveName(typed, board);
    board = recordRun(board, { name, ...run });
    saveBoard(storage, trial, board);
    if (typed !== '') saveLastName(storage, name);

    savedAs = name;
    nameInput.value = name;
    nameForm.hidden = true;
    paintBoard(name);
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
    // The log says both things: the trial the teacher chose, and the range the
    // device proved it hears. An unmeasured session says `false`/`null`.
    const effective = result.portata === null
      ? null
      : effectiveRange(result.settings.range, result.portata);
    downloadable = {
      name: logFileName(when),
      text: logJson(
        sessionLog({
          when,
          settings: result.settings,
          state: result.state,
          targets: result.targets,
          rangeMeasured: result.portata !== null,
          rangeEffective: effective ?? undefined,
        }),
      ),
    };
    logGroup.hidden = false;

    // The classifica of the trial just played, and the name of the last run:
    // the usual gesture is a confirmation, not a name typed from scratch.
    const storage = browserStorage();
    trial = result.settings;
    run = {
      corrette: summary.centered,
      notePerMinute: result.state.score.notesPerMinute,
      when: when.getTime(),
    };
    board = loadBoard(storage, result.settings);
    savedAs = null;
    nameInput.maxLength = NAME_MAX_LENGTH;
    nameInput.value = loadLastName(storage) ?? '';
    // The empty field is not an error: it gets the first free `utenteN`, and the
    // field says which one before it is confirmed.
    nameInput.placeholder = freeName(board);
    nameForm.hidden = false;
    boardGroup.hidden = false;
    paintBoard(null);

    ports.wizard.show('summary');
  }

  function clear(): void {
    downloadable = null;
    logGroup.hidden = true;
    trial = null;
    run = null;
    board = [];
    savedAs = null;
    boardGroup.hidden = true;
    boardList.replaceChildren();
  }

  logButton.addEventListener('click', downloadLog);
  nameForm.addEventListener('submit', saveRun);
  restartButton.addEventListener('click', ports.restart);

  return { show, clear };
}
