/**
 * :Project:  suona-la-nota -- the exercise screen
 * :Created:  dom 08 nov 2026 23:10:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The page is the wiring, nothing else: it owns the DOM, the microphone and the
 * clock, and hands them to the exercise in ../exercise, which owns the rules.
 *
 * Three decisions live here because they are about the browser and not about
 * the exercise:
 *
 *  - the microphone is opened on the button, because that is the only gesture
 *    the browser accepts;
 *  - the tone the application makes is heard by its own microphone for a few
 *    hundred milliseconds, and the colpi it produces are dropped: they are the
 *    phone talking to itself;
 *  - a tab that is not watched is not a session being played, so going to the
 *    background pauses it instead of burning a minute of targets.
 */
import { createListener } from './audio/listener';
import { openAudioInput, type AudioInput } from './audio/microphone';
import { createExercise, type Exercise } from './exercise/controller';
import { summarise, type SummarySeries } from './exercise/summary';
import { seriesSheet } from './score/layout';
import { drawNotes, drawTarget } from './score/sheet';
import { ADVANCED_RANGE, BASE_RANGE, keysInRange, nearestPlacement, type KeyRange } from './score/staff';
import type { EndReason, SessionState, Verdict } from './session/engine';

/**
 * Below this credibility a colpo is noise and does not enter the exercise.
 * Four is the number the spike measured, not a preference (docs/adr/0004).
 */
const MIN_CREDIBILITY = 4;

/** How long after the beep the microphone's frames are not believed. */
const BEEP_MUTE_MS = 300;

/** How long the green or the red stays on the paper. */
const FLASH_MS = 350;

/** A session lasts a minute unless the page is opened with `?duration=`. */
const DEFAULT_DURATION_MS = 60_000;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`#${id} is missing from the page`);
  return found as T;
}

const sheet = element<HTMLDivElement>('target');
const statusLine = element<HTMLParagraphElement>('status');
const messageLine = element<HTMLParagraphElement>('message');
const startButton = element<HTMLButtonElement>('start');
const pauseButton = element<HTMLButtonElement>('pause');
const restartButton = element<HTMLButtonElement>('restart');
const exerciseCard = element<HTMLElement>('exercise');
const summaryCard = element<HTMLElement>('summary');
const summaryReason = element<HTMLParagraphElement>('summary-reason');
const summaryScore = element<HTMLParagraphElement>('summary-score');
const summaryRate = element<HTMLParagraphElement>('summary-rate');
const wrongGroup = element<HTMLElement>('wrong-group');
const wrongNotes = element<HTMLDivElement>('wrong-notes');
const skippedGroup = element<HTMLElement>('skipped-group');
const skippedNotes = element<HTMLDivElement>('skipped-notes');
const rangeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="range"]'));

interface Running {
  audio: AudioInput;
  exercise: Exercise;
  /** Until this instant the colpi the microphone hears are the beep coming back. */
  muteUntil: number;
}

let running: Running | null = null;
let flashTimer: number | null = null;

function currentRange(): KeyRange {
  const chosen = rangeInputs.find((input) => input.checked);
  return chosen?.value === 'advanced' ? ADVANCED_RANGE : BASE_RANGE;
}

function sessionDurationMs(): number {
  const asked = new URLSearchParams(window.location.search).get('duration');
  const seconds = asked === null ? NaN : Number(asked);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : DEFAULT_DURATION_MS;
}

/** The keys of a range, in a random order and without repeats: a session asks each at most once. */
function randomKeys(range: KeyRange): number[] {
  const keys = keysInRange(range);
  for (let index = keys.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [keys[index], keys[other]] = [keys[other], keys[index]];
  }
  return keys;
}

function flash(verdict: Verdict): void {
  const kind = verdict === 'centered' ? 'flash-good' : 'flash-bad';
  sheet.classList.remove('flash-good', 'flash-bad');
  // Restart the animation even when two colpi land back to back.
  void sheet.offsetWidth;
  sheet.classList.add(kind);
  if (flashTimer !== null) window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => sheet.classList.remove('flash-good', 'flash-bad'), FLASH_MS);
}

/** A line under the staff, or the counter back in its place. */
function showMessage(text: string | null): void {
  if (text === null) {
    messageLine.hidden = true;
    statusLine.hidden = false;
    return;
  }
  messageLine.textContent = text;
  messageLine.hidden = false;
  statusLine.hidden = true;
}

function showStatus(snapshot: SessionState): void {
  const seconds = Math.ceil(snapshot.remainingMs / 1000);
  const parts = [`${seconds} s`, `${snapshot.score.centered} centrate`];
  if (snapshot.paused) parts.push('in pausa');
  statusLine.textContent = parts.join(' · ');
}

function setSettingsEnabled(enabled: boolean): void {
  for (const input of rangeInputs) input.disabled = !enabled;
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

/** "1 centrata" but "3 centrate": a summary that a teacher reads aloud has to agree. */
function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

function finish(reason: EndReason, state: SessionState): void {
  const current = running;
  running = null;
  current?.audio.stop();

  const summary = summarise(state, current?.exercise.placements());
  summaryReason.textContent = reason === 'duration'
    ? 'È scaduto il tempo.'
    : 'La lista dei bersagli è finita.';
  summaryScore.textContent = [
    count(summary.centered, 'centrata', 'centrate'),
    count(summary.wrong, 'sbagliata', 'sbagliate'),
    count(summary.skipped, 'saltata', 'saltate'),
    `${summary.total} in tutto`,
  ].join(' · ');
  // "1 nota al minuto" but "4,5 note al minuto": the same agreement as the counts.
  summaryRate.textContent =
    `${summary.notesPerMinute} ${summary.notesPerMinute === '1' ? 'nota' : 'note'} al minuto`;

  fillSeries(wrongNotes, summary.wrongNotes);
  fillSeries(skippedNotes, summary.skippedNotes);
  // An empty list says nothing: no heading, no empty row.
  wrongGroup.hidden = summary.wrongNotes.length === 0;
  skippedGroup.hidden = summary.skippedNotes.length === 0;

  exerciseCard.hidden = true;
  summaryCard.hidden = false;
  pauseButton.hidden = true;
  showMessage(null);
  setSettingsEnabled(true);
}

/** Back to the exercise screen, without reloading the page. */
function backToStart(): void {
  summaryCard.hidden = true;
  exerciseCard.hidden = false;
  pauseButton.hidden = true;
  startButton.hidden = false;
  startButton.disabled = false;
  setSettingsEnabled(true);

  const keys = keysInRange(currentRange());
  drawTarget(sheet, nearestPlacement(keys[Math.floor(Math.random() * keys.length)]));
  showMessage(null);
  statusLine.textContent = 'Premi Inizia, poi suona la nota che vedi.';
}

async function startSession(): Promise<void> {
  if (running !== null) return;
  const range = currentRange();

  startButton.disabled = true;
  summaryCard.hidden = true;
  exerciseCard.hidden = false;
  showMessage(null);

  const listener = createListener({
    lowMidi: range.lowest,
    highMidi: range.highest,
    minCredibility: MIN_CREDIBILITY,
  });

  let audio: AudioInput;
  try {
    audio = await openAudioInput((samples, sampleRate, now) => {
      const current = running;
      if (current === null) return;
      const frame = listener.push(samples, sampleRate, now);
      // The beep leaves this phone's speaker and comes back into its
      // microphone: what it produces is not the allievo's colpo.
      current.exercise.feed({
        at: now,
        levelDb: frame.levelDb,
        colpi: now < current.muteUntil ? [] : frame.colpi,
      });
    });
  } catch (error) {
    startButton.disabled = false;
    showMessage(
      error instanceof Error && error.name === 'NotAllowedError'
        ? 'Senza il microfono non si può ascoltare: concedilo e riprova.'
        : 'Il microfono non si è aperto: riprova.',
    );
    return;
  }

  const exercise = createExercise({
    keys: randomKeys(range),
    config: { durationMs: sessionDurationMs() },
    ports: {
      draw: (placement) => drawTarget(sheet, placement),
      flash,
      beep: () => {
        audio.beep();
        const current = running;
        if (current !== null) current.muteUntil = performance.now() + BEEP_MUTE_MS;
        listener.clearPending();
      },
      message: showMessage,
      status: showStatus,
      end: finish,
    },
  });

  running = { audio, exercise, muteUntil: 0 };

  startButton.hidden = true;
  pauseButton.hidden = false;
  pauseButton.textContent = 'Pausa';
  setSettingsEnabled(false);
}

function togglePause(): void {
  const current = running;
  if (current === null) return;
  if (current.exercise.state().paused) {
    current.exercise.resume();
    pauseButton.textContent = 'Pausa';
    return;
  }
  current.exercise.pause();
  pauseButton.textContent = 'Riprendi';
}

async function main(): Promise<void> {
  await document.fonts.ready;

  // Something on the paper before the allievo presses anything: the screen is
  // the exercise, and an empty staff would look broken.
  const preview = keysInRange(currentRange());
  drawTarget(sheet, nearestPlacement(preview[Math.floor(Math.random() * preview.length)]));
  statusLine.textContent = 'Premi Inizia, poi suona la nota che vedi.';

  startButton.addEventListener('click', () => void startSession());
  restartButton.addEventListener('click', backToStart);
  pauseButton.addEventListener('click', togglePause);

  for (const input of rangeInputs) {
    input.addEventListener('change', () => {
      if (running !== null) return;
      const keys = keysInRange(currentRange());
      drawTarget(sheet, nearestPlacement(keys[Math.floor(Math.random() * keys.length)]));
    });
  }

  document.addEventListener('visibilitychange', () => {
    const current = running;
    if (document.hidden && current !== null && !current.exercise.state().paused) {
      current.exercise.pause();
      pauseButton.textContent = 'Riprendi';
    }
  });

  // A measurement shortcut, not part of the flow: it lets a headless browser
  // with a fake microphone start the exercise without a click.
  if (new URLSearchParams(window.location.search).get('autostart') === '1') {
    void startSession();
  }
}

void main();
