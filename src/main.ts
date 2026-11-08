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
 * The summary hands over the log of the session: the file is built once, when the
 * session ends, by ../session/log, and the button only makes it a download.
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
 *    the system for less motion;
 *  - the teacher's list is remembered in the browser and nowhere else: it is
 *    the one part of the trial that outlives the page (ADR 0011), because a
 *    maestra composes it once and the allievo must find it there tomorrow.
 */
import { createListener } from './audio/listener';
import { openAudioInput, type AudioInput } from './audio/microphone';
import { midiToItalian, pianoKeys, pitchClass } from './audio/notes';
import { createExercise, type Exercise } from './exercise/controller';
import {
  listFromJson,
  listToJson,
  loadList,
  saveList,
  toggleKey,
  type StoragePort,
} from './exercise/list';
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
import {
  ADVANCED_RANGE,
  BASE_RANGE,
  isInRange,
  keysInRange,
  nearestPlacement,
  type KeyRange,
} from './score/staff';
import type { EndReason, SessionState, Verdict } from './session/engine';
import { logFileName, logJson, sessionLog } from './session/log';

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
const logGroup = element<HTMLElement>('log-group');
const logButton = element<HTMLButtonElement>('log');
const rangeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="range"]'));
const modeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="mode"]'));
const listField = element<HTMLElement>('list-field');
const keyboard = element<HTMLDivElement>('keyboard');
const listCount = element<HTMLParagraphElement>('list-count');
const listMessage = element<HTMLParagraphElement>('list-message');
const listExport = element<HTMLButtonElement>('list-export');
const listImport = element<HTMLButtonElement>('list-import');
const listFile = element<HTMLInputElement>('list-file');

/** The name of the file a teacher keeps and hands to another phone. */
const LIST_FILE_NAME = 'lista-della-maestra.json';

/** The twelve pitch classes as the keyboard draws them: the sharps are the black keys. */
const BLACK_KEY_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** A row of the keyboard starts on a C, the only key that has no black key before it. */
const C_PITCH_CLASS = 0;

/** The white keys of an octave, and the width of a row that holds them at a phone's size. */
const OCTAVE_WHITES = 7;

/** The browser's storage, or `null` when it refuses to be read at all. */
function browserStorage(): StoragePort | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The list the teacher composes, in the order she ticked it: read back at
 * startup and written on every change, so a lesson prepared yesterday is still
 * on the phone today.
 */
let teacherList: readonly number[] = loadList(browserStorage());

/** The range the keyboard on screen was built for: a change of range rebuilds it. */
let drawnRange: KeyRange | null = null;

interface Running {
  audio: AudioInput;
  exercise: Exercise;
  /** The trial in force, kept for the log: the controls may have moved since. */
  settings: Settings;
  /** Until this instant the colpi the microphone hears are the beep coming back. */
  muteUntil: number;
}

/** The file the summary hands over, built the once, when the session ends. */
let downloadable: { readonly name: string; readonly text: string } | null = null;

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
 * The keys of a range grouped by octave, each row starting at a C. Seven white
 * keys across are what fits a 390 px phone with a finger-sized target on each;
 * one keyboard per octave keeps the map readable where a single run would
 * shrink the keys below what a child can hit.
 */
function octaveRows(range: KeyRange): number[][] {
  const rows: number[][] = [];
  for (const midi of keysInRange(range)) {
    if (rows.length === 0 || pitchClass(midi) === C_PITCH_CLASS) rows.push([]);
    rows[rows.length - 1].push(midi);
  }
  return rows;
}

/** Ticked or not, with its place in the list: the order is what the list is for. */
function paintKey(button: HTMLButtonElement, midi: number): void {
  const place = teacherList.indexOf(midi) + 1;
  const name = midiToItalian(midi);
  button.classList.toggle('ticked', place > 0);
  button.setAttribute('aria-pressed', String(place > 0));
  button.setAttribute('aria-label', place > 0 ? `${name}, ${place}° nella lista` : name);
  button.replaceChildren();
  if (!button.classList.contains('black')) button.append(name);
  if (place > 0) {
    const order = document.createElement('span');
    order.className = 'order';
    order.textContent = String(place);
    button.append(order);
  }
}

/** The keyboard of the range in force: white keys in a row, black keys on the gaps between them. */
function drawKeyboard(range: KeyRange): void {
  keyboard.replaceChildren();
  for (const row of octaveRows(range)) {
    const octave = document.createElement('div');
    octave.className = 'octave';
    // A row keeps the width of a full octave even when the range cuts it short,
    // so that a key is as wide in the first row as in the last.
    const share = 100 / OCTAVE_WHITES;
    let placed = 0;
    for (const midi of row) {
      const button = document.createElement('button');
      button.type = 'button';
      const white = !BLACK_KEY_PITCH_CLASSES.has(pitchClass(midi));
      button.dataset.key = String(midi);
      if (white) {
        button.className = 'key white';
        button.style.width = `${share}%`;
        placed++;
      } else if (placed === 0) {
        // A range that begins on a black key has no white key to stand on: the
        // key stands on its own, at the width of a white one.
        button.className = 'key lone';
        button.style.width = `${share}%`;
      } else {
        button.className = 'key black';
        // A black key sits on the boundary between two white ones, half of it
        // over each; a row that begins on a black key keeps it inside the row
        // instead of letting half of it hang off the edge.
        const width = share * 0.62;
        button.style.width = `${width}%`;
        button.style.left = `${Math.min(100 - width, Math.max(0, placed * share - width / 2))}%`;
      }
      paintKey(button, midi);
      octave.append(button);
    }
    keyboard.append(octave);
  }
  drawnRange = range;
}

/** A rebuild after a tick, with the focus put back on the key just touched. */
function redrawKeyboard(): void {
  const focused = document.activeElement;
  const key = focused instanceof HTMLElement ? focused.dataset.key : undefined;
  drawKeyboard(chosenRange());
  if (key !== undefined) {
    keyboard.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)?.focus();
  }
}

/** How many keys the list holds, and how many of them the range in force will not ask for. */
function describeList(range: KeyRange): string {
  if (teacherList.length === 0) {
    return 'La lista è vuota: tocca i tasti per scegliere le note da chiedere.';
  }
  const parts = [`${count(teacherList.length, 'tasto', 'tasti')} nella lista.`];
  const outside = teacherList.filter((key) => !isInRange(key, range)).length;
  if (outside === 1) parts.push('Un tasto è fuori dal range attivo: non verrà chiesto.');
  else if (outside > 1) parts.push(`${outside} tasti sono fuori dal range attivo: non verranno chiesti.`);
  return parts.join(' ');
}

/** One line under the keyboard, for what an import had to say. */
function showListMessage(text: string, bad: boolean): void {
  listMessage.textContent = text;
  listMessage.classList.toggle('bad', bad);
  listMessage.hidden = false;
}

/** A tick on the keyboard: the list, its memory and the trial that will be played. */
function tickKey(midi: number): void {
  teacherList = toggleKey(teacherList, midi);
  saveList(browserStorage(), teacherList);
  redrawKeyboard();
  if (running === null && !starting) refreshSettings();
}

/** The list as a file the teacher can keep, mail, or open on another phone. */
function exportList(): void {
  saveFile(LIST_FILE_NAME, listToJson(teacherList), 'application/json');
  showListMessage(
    teacherList.length === 0
      ? 'La lista è vuota: il file appena scaricato non contiene tasti.'
      : `Esportati ${count(teacherList.length, 'tasto', 'tasti')}.`,
    false,
  );
}

/**
 * The list as it arrives from a file: the keys of the file replace the list,
 * the ones off the piano are reported and left out, and a file that is not ours
 * is a sentence, not a broken screen.
 */
async function importList(file: File): Promise<void> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    showListMessage('Il file non si è potuto leggere: riprova a sceglierlo.', true);
    return;
  }

  const read = listFromJson(text);
  if (read.kind === 'invalid') {
    showListMessage(read.message, true);
    return;
  }

  teacherList = read.keys;
  saveList(browserStorage(), teacherList);
  redrawKeyboard();
  if (running === null && !starting) refreshSettings();

  const parts = [
    read.keys.length === 0
      ? 'Il file non conteneva tasti: la lista è vuota.'
      : `Lista importata: ${count(read.keys.length, 'tasto', 'tasti')}.`,
  ];
  if (read.rejected.length === 1) {
    parts.push('Un tasto non è sul pianoforte: è rimasto fuori.');
  } else if (read.rejected.length > 1) {
    parts.push(`${read.rejected.length} tasti non sono sul pianoforte: sono rimasti fuori.`);
  }
  showListMessage(parts.join(' '), read.rejected.length > 0);
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
  listField.hidden = settings.mode !== 'list';
  if (
    drawnRange === null ||
    drawnRange.lowest !== settings.range.lowest ||
    drawnRange.highest !== settings.range.highest
  ) {
    drawKeyboard(settings.range);
  }
  listCount.textContent = describeList(settings.range);
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

/**
 * Hand a file over: a Blob, a link the page clicks for it, and the object URL
 * revoked once the browser has had time to start the download. One function for
 * both files the page produces, because the timing of that revoke is not a
 * detail to get right twice.
 */
function saveFile(name: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking at once cuts the download off on some browsers; a second is enough.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** The log the summary hands over, built once, when the session ends. */
function downloadLog(): void {
  if (downloadable === null) return;
  saveFile(downloadable.name, downloadable.text, 'application/json');
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
  // The log of the session just played is not the log of the next one.
  downloadable = null;
  logGroup.hidden = true;
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

  // The log is written now, from the state the summary is showing and from what
  // the exercise heard: after this instant the page forgets the session, and the
  // file is all that is left of it.
  const when = new Date();
  const targets = current === null ? [] : current.exercise.log();
  // Even a session that closed no bersaglio has a log: the settings in force and
  // the score are evidence too, and "no log at all" would be the one answer the
  // teacher cannot read.
  downloadable = current === null
    ? null
    : {
        name: logFileName(when),
        text: logJson(sessionLog({ when, settings: current.settings, state, targets })),
      };
  logGroup.hidden = downloadable === null;

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

  running = { audio, exercise, settings, muteUntil: 0 };
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
  logButton.addEventListener('click', downloadLog);
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

  // The keyboard, and the file a list travels in: both live on the setup
  // screen only, and neither is reachable while a session is being built.
  keyboard.addEventListener('click', (event) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-key]')
      : null;
    if (button === null || running !== null || starting) return;
    tickKey(Number(button.dataset.key));
  });
  listExport.addEventListener('click', exportList);
  listImport.addEventListener('click', () => listFile.click());
  listFile.addEventListener('change', () => {
    const file = listFile.files?.[0];
    // Clearing the field lets the same file be chosen again after a fix.
    listFile.value = '';
    if (file !== undefined) void importList(file);
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
