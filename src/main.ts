/**
 * :Project:  suona-la-nota -- the exercise screen
 * :Created:  dom 08 nov 2026 23:10:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The page is the wiring, nothing else: it owns the DOM, the microphone and the
 * clock, and hands them to the exercise in ../exercise, which owns the rules.
 * The trial itself — range, clocks, cap, sequence — is ../exercise/settings, so
 * the controls here only read and write what that module already knows.
 *
 * The page is a wizard: one screen at a time, the configuration first, then the
 * staff, then the summary, and no way past the first without pressing
 * "Comincia". A URL can dictate the trial (`?duration=30&range=advanced`, see
 * docs/adr/0011): then the configuration screen is skipped, because the link
 * already answered the question it would ask.
 *
 * Four decisions live here because they are about the browser and not about
 * the exercise:
 *
 *  - the microphone is opened on the button, because that is the only gesture
 *    the browser accepts;
 *  - the tone the application makes is heard by its own microphone for a few
 *    hundred milliseconds, and the colpi it produces are dropped: they are the
 *    phone talking to itself;
 *  - a tab that is not watched is not a session being played, so going to the
 *    background pauses it instead of burning a minute of targets;
 *  - the screens move with a short rise, and not at all for those who asked
 *    the system for less motion.
 */
import { createListener } from './audio/listener';
import { openAudioInput, type AudioInput } from './audio/microphone';
import { midiToItalian, pianoKeys } from './audio/notes';
import { createExercise, type Exercise } from './exercise/controller';
import {
  DEFAULT_SETTINGS,
  PRESETS,
  clampRange,
  isSequenceMode,
  normalise,
  problemWith,
  sequenceFor,
  sessionConfigOf,
  settingsFromQuery,
  type SequenceMode,
  type Settings,
} from './exercise/settings';
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

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`#${id} is missing from the page`);
  return found as T;
}

const setupCard = element<HTMLElement>('setup');
const lowestSelect = element<HTMLSelectElement>('lowest');
const highestSelect = element<HTMLSelectElement>('highest');
const durationInput = element<HTMLInputElement>('duration');
const timeoutInput = element<HTMLInputElement>('target-timeout');
const capInput = element<HTMLInputElement>('cap-on');
const limitInput = element<HTMLInputElement>('wrong-limit');
const presetSelect = element<HTMLSelectElement>('preset');
const presetField = element<HTMLElement>('preset-field');
const settingsHint = element<HTMLParagraphElement>('settings-hint');
const beginButton = element<HTMLButtonElement>('begin');
const backButton = element<HTMLButtonElement>('back');
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
const modeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="mode"]'));

/**
 * The list the teacher composes. Empty in this round: the screen that fills it
 * is ticket 07, and until then the mode says so instead of playing nothing.
 */
const teacherList: readonly number[] = [];

interface Running {
  audio: AudioInput;
  exercise: Exercise;
  /** Until this instant the colpi the microphone hears are the beep coming back. */
  muteUntil: number;
}

let running: Running | null = null;
/** True from the click to the microphone being open: a second click must not start a second session. */
let starting = false;
let flashTimer: number | null = null;

/** One option per piano key, named the way an Italian teacher says it. */
function fillKeyOptions(select: HTMLSelectElement): void {
  for (const midi of pianoKeys()) {
    const option = document.createElement('option');
    option.value = String(midi);
    option.textContent = midiToItalian(midi);
    select.append(option);
  }
}

function fillPresetOptions(): void {
  for (const preset of PRESETS) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    presetSelect.append(option);
  }
}

/** The range the two selects say, put back in order and inside the piano. */
function chosenRange(): KeyRange {
  return clampRange(Number(lowestSelect.value), Number(highestSelect.value));
}

/** The controls write the normalised range back, so the screen never lies. */
function applyRange(range: KeyRange): void {
  lowestSelect.value = String(range.lowest);
  highestSelect.value = String(range.highest);
}

function checkedMode(): SequenceMode {
  const chosen = modeInputs.find((input) => input.checked)?.value ?? null;
  return isSequenceMode(chosen) ? chosen : DEFAULT_SETTINGS.mode;
}

/** The trial as the controls have it, with the defaults filled in and the range in order. */
function chosenSettings(): Settings {
  return normalise({
    ...DEFAULT_SETTINGS,
    range: chosenRange(),
    durationMs: Number(durationInput.value) * 1000,
    targetTimeoutMs: Number(timeoutInput.value) * 1000,
    wrongLimit: capInput.checked ? Number(limitInput.value) : null,
    mode: checkedMode(),
    presetId: presetSelect.value,
    list: teacherList,
  });
}

/**
 * The trial cannot start with no targets: say why instead of starting nothing,
 * and answer with it. The controls get back what the trial will actually use,
 * so the screen never promises a clock or a cap the session does not apply.
 */
function refreshSettings(): string | null {
  const settings = chosenSettings();
  durationInput.value = String(settings.durationMs / 1000);
  timeoutInput.value = String(settings.targetTimeoutMs / 1000);
  if (settings.wrongLimit !== null) limitInput.value = String(settings.wrongLimit);

  const problem = problemWith(settings);
  settingsHint.textContent = problem ?? '';
  settingsHint.hidden = problem === null;
  beginButton.disabled = problem !== null;
  startButton.disabled = starting || problem !== null;
  presetField.hidden = settings.mode !== 'preset';
  return problem;
}

/** The controls show a trial that came from somewhere else: the URL, or the defaults. */
function applySettingsToControls(settings: Settings): void {
  applyRange(settings.range);
  // A range that is neither preset is one somebody edited: no radio is right.
  const rangePreset = settings.range.lowest === BASE_RANGE.lowest && settings.range.highest === BASE_RANGE.highest
    ? 'base'
    : settings.range.lowest === ADVANCED_RANGE.lowest && settings.range.highest === ADVANCED_RANGE.highest
      ? 'advanced'
      : null;
  for (const input of rangeInputs) input.checked = input.value === rangePreset;

  durationInput.value = String(settings.durationMs / 1000);
  timeoutInput.value = String(settings.targetTimeoutMs / 1000);
  capInput.checked = settings.wrongLimit !== null;
  if (settings.wrongLimit !== null) limitInput.value = String(settings.wrongLimit);
  limitInput.disabled = !capInput.checked;
  for (const input of modeInputs) input.checked = input.value === settings.mode;
  presetSelect.value = settings.presetId;
}

type ScreenName = 'setup' | 'exercise' | 'summary';

const SCREENS: Readonly<Record<ScreenName, HTMLElement>> = {
  setup: setupCard,
  exercise: exerciseCard,
  summary: summaryCard,
};

/**
 * One screen at a time, with the rise the wizard asked for. The class is taken
 * away and put back so that going from a screen to itself animates too, which
 * is what happens when a session is replayed.
 */
function showScreen(name: ScreenName): void {
  for (const [candidate, screen] of Object.entries(SCREENS)) screen.hidden = candidate !== name;
  const shown = SCREENS[name];
  shown.classList.remove('screen-in');
  void shown.offsetWidth;
  shown.classList.add('screen-in');
}

/** The exercise screen, ready: the trial on the staff, and the button that opens the microphone. */
function showExerciseScreen(): void {
  showScreen('exercise');
  const problem = refreshSettings();
  if (problem === null) {
    drawPreview();
    statusLine.textContent = 'Premi Inizia, poi suona la nota che vedi.';
  } else {
    statusLine.textContent = problem;
  }
  backButton.hidden = false;
}

/** Back to the configuration, with the same values, without starting anything. */
function backToSetup(): void {
  if (running !== null || starting) return;
  showScreen('setup');
  pauseButton.hidden = true;
  startButton.hidden = false;
  refreshSettings();
  showMessage(null);
}

/** Something on the paper before the allievo presses anything, on the chosen range. */
function drawPreview(): void {
  if (running !== null || starting) return;
  const keys = keysInRange(chosenRange());
  drawTarget(sheet, nearestPlacement(keys[Math.floor(Math.random() * keys.length)]));
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

  showScreen('summary');
  pauseButton.hidden = true;
  showMessage(null);
}

async function startSession(): Promise<void> {
  if (running !== null || starting) return;
  const settings = chosenSettings();
  if (problemWith(settings) !== null) {
    refreshSettings();
    return;
  }

  // From here to the open microphone nothing is to be touched: the way back
  // goes away at once, so no change can land on a trial already being built.
  starting = true;
  startButton.disabled = true;
  backButton.hidden = true;
  showMessage(null);

  const listener = createListener({
    lowMidi: settings.range.lowest,
    highMidi: settings.range.highest,
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
    starting = false;
    backButton.hidden = false;
    refreshSettings();
    showMessage(
      error instanceof Error && error.name === 'NotAllowedError'
        ? 'Senza il microfono non si può ascoltare: concedilo e riprova.'
        : 'Il microfono non si è aperto: riprova.',
    );
    return;
  }

  // The sequence is drawn once, at the start: the range cannot be exhausted
  // and refilled behind the allievo's back.
  const exercise = createExercise({
    keys: sequenceFor(settings),
    config: sessionConfigOf(settings),
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
  starting = false;

  // Nothing to touch while the trial runs, and the staff gets the screen.
  startButton.hidden = true;
  pauseButton.hidden = false;
  pauseButton.textContent = 'Pausa';
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

  fillKeyOptions(lowestSelect);
  fillKeyOptions(highestSelect);
  fillPresetOptions();

  // The URL may have already chosen the trial. What it leaves out keeps the
  // defaults, and the controls show what the session will actually use.
  const params = new URLSearchParams(window.location.search);
  const fromUrl = settingsFromQuery(params);
  applySettingsToControls(fromUrl.settings);
  refreshSettings();

  // The configuration screen is the way in unless a link already chose the
  // trial — and `?autostart=1`, whose whole point is a session without a click.
  const autostart = params.get('autostart') === '1';
  if (fromUrl.skipSetup || autostart) showExerciseScreen();
  else showScreen('setup');

  startButton.addEventListener('click', () => void startSession());
  beginButton.addEventListener('click', showExerciseScreen);
  backButton.addEventListener('click', backToSetup);
  restartButton.addEventListener('click', backToSetup);
  pauseButton.addEventListener('click', togglePause);
  capInput.addEventListener('change', () => {
    limitInput.disabled = !capInput.checked;
    if (running === null && !starting) refreshSettings();
  });

  for (const input of rangeInputs) {
    input.addEventListener('change', () => {
      if (running !== null || starting) return;
      applyRange(input.value === 'advanced' ? ADVANCED_RANGE : BASE_RANGE);
      refreshSettings();
    });
  }

  for (const select of [lowestSelect, highestSelect]) {
    select.addEventListener('change', () => {
      if (running !== null || starting) return;
      // A hand-edited range is no longer the preset: the two radios go back
      // to no choice, and the selects show the range actually in force.
      for (const input of rangeInputs) input.checked = false;
      applyRange(chosenRange());
      refreshSettings();
    });
  }

  for (const input of [durationInput, timeoutInput, limitInput, ...modeInputs]) {
    input.addEventListener('change', () => {
      if (running === null && !starting) refreshSettings();
    });
  }
  presetSelect.addEventListener('change', () => {
    if (running === null && !starting) refreshSettings();
  });

  document.addEventListener('visibilitychange', () => {
    const current = running;
    if (document.hidden && current !== null && !current.exercise.state().paused) {
      current.exercise.pause();
      pauseButton.textContent = 'Riprendi';
    }
  });

  // A measurement shortcut, not part of the flow: it lets a headless browser
  // with a fake microphone start the exercise without a click.
  if (autostart) void startSession();
}

void main();
