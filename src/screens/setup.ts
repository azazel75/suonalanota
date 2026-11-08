/**
 * :Project:  suona-la-nota -- the screen where the trial is chosen
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The setup screen: range, clocks, cap, sequence, and the teacher's list with
 * its keyboard. It owns the controls and reads nothing that belongs to another
 * screen; what it needs to know about a session — whether one is running or
 * being built — it asks, through a port.
 *
 * Two parts of the trial live here and not in `../exercise`: the list the
 * teacher ticks (remembered in the browser and nowhere else, ADR 0011), and the
 * rule that the controls write back what the session will actually use, so the
 * screen never promises a clock or a cap the session does not apply.
 */
import { midiToItalian, pianoKeys } from '../audio/notes';
import {
  listFromJson,
  listToJson,
  loadList,
  saveList,
  toggleKey,
  type StoragePort,
} from '../exercise/list';
import {
  DEFAULT_SETTINGS,
  PRESETS,
  clampRange,
  isSequenceMode,
  normalise,
  problemWith,
  type SequenceMode,
  type Settings,
} from '../exercise/settings';
import { layoutRow, octaveRows } from '../score/keyboard';
import { ADVANCED_RANGE, BASE_RANGE, type KeyRange } from '../score/staff';
import { element, saveFile } from '../ui/dom';
import { count } from '../ui/text';
import { describeList } from './setup-text';

/** What the page asks of this screen, and nothing more. */
export interface SetupScreen {
  /** The trial the controls describe, normalised: what a session would start with. */
  settings(): Settings;
  /** Writes a trial into the controls: from the URL, or from a soundcheck. */
  apply(settings: Settings): void;
  /** Puts the controls back in agreement with the trial in force; answers with the problem, if any. */
  refresh(): string | null;
}

/** What this screen needs from the rest of the page. */
export interface SetupPorts {
  /** True from the click to the microphone being open, and while a session runs. */
  readonly busy: () => boolean;
  /** The trial may have changed: whoever starts a session has to look again. */
  readonly changed: (problem: string | null) => void;
  /** "Comincia" was pressed. */
  readonly begin: () => void;
}

/** The name of the file a teacher keeps and hands to another phone. */
const LIST_FILE_NAME = 'lista-della-maestra.json';

/** The browser's storage, or `null` when it refuses to be read at all. */
function browserStorage(): StoragePort | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createSetupScreen(ports: SetupPorts): SetupScreen {
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
  const rangeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="range"]'));
  const modeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="mode"]'));
  const listField = element<HTMLElement>('list-field');
  const keyboard = element<HTMLDivElement>('keyboard');
  const listCount = element<HTMLParagraphElement>('list-count');
  const listMessage = element<HTMLParagraphElement>('list-message');
  const listExport = element<HTMLButtonElement>('list-export');
  const listImport = element<HTMLButtonElement>('list-import');
  const listFile = element<HTMLInputElement>('list-file');

  /**
   * The list the teacher composes, in the order she ticked it: read back at
   * startup and written on every change, so a lesson prepared yesterday is still
   * on the phone today.
   */
  let teacherList: readonly number[] = loadList(browserStorage());

  /** The range the keyboard on screen was built for: a change of range rebuilds it. */
  let drawnRange: KeyRange | null = null;

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
      for (const box of layoutRow(row)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.key = String(box.midi);
        button.className = `key ${box.shape}`;
        button.style.width = `${box.width}%`;
        if (box.left !== null) button.style.left = `${box.left}%`;
        paintKey(button, box.midi);
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
    if (!ports.busy()) refresh();
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
    if (!ports.busy()) refresh();

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
  function refresh(): string | null {
    const settings = chosenSettings();
    durationInput.value = String(settings.durationMs / 1000);
    timeoutInput.value = String(settings.targetTimeoutMs / 1000);
    if (settings.wrongLimit !== null) limitInput.value = String(settings.wrongLimit);

    const problem = problemWith(settings);
    settingsHint.textContent = problem ?? '';
    settingsHint.hidden = problem === null;
    beginButton.disabled = problem !== null;
    presetField.hidden = settings.mode !== 'preset';
    listField.hidden = settings.mode !== 'list';
    if (
      drawnRange === null ||
      drawnRange.lowest !== settings.range.lowest ||
      drawnRange.highest !== settings.range.highest
    ) {
      drawKeyboard(settings.range);
    }
    listCount.textContent = describeList(teacherList, settings.range);
    ports.changed(problem);
    return problem;
  }

  /** The controls show a trial that came from somewhere else: the URL, or the defaults. */
  function apply(settings: Settings): void {
    applyRange(settings.range);
    // A range that is neither preset is one somebody edited: no radio is right.
    const rangePreset =
      settings.range.lowest === BASE_RANGE.lowest && settings.range.highest === BASE_RANGE.highest
        ? 'base'
        : settings.range.lowest === ADVANCED_RANGE.lowest &&
            settings.range.highest === ADVANCED_RANGE.highest
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

  fillKeyOptions(lowestSelect);
  fillKeyOptions(highestSelect);
  fillPresetOptions();

  beginButton.addEventListener('click', ports.begin);

  capInput.addEventListener('change', () => {
    limitInput.disabled = !capInput.checked;
    if (!ports.busy()) refresh();
  });

  for (const input of rangeInputs) {
    input.addEventListener('change', () => {
      if (ports.busy()) return;
      applyRange(input.value === 'advanced' ? ADVANCED_RANGE : BASE_RANGE);
      refresh();
    });
  }

  for (const select of [lowestSelect, highestSelect]) {
    select.addEventListener('change', () => {
      if (ports.busy()) return;
      // A hand-edited range is no longer the preset: the two radios go back
      // to no choice, and the selects show the range actually in force.
      for (const input of rangeInputs) input.checked = false;
      applyRange(chosenRange());
      refresh();
    });
  }

  for (const input of [durationInput, timeoutInput, limitInput, ...modeInputs]) {
    input.addEventListener('change', () => {
      if (!ports.busy()) refresh();
    });
  }
  presetSelect.addEventListener('change', () => {
    if (!ports.busy()) refresh();
  });

  // The keyboard, and the file a list travels in: both live on this screen only,
  // and neither is reachable while a session is being built.
  keyboard.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('button[data-key]')
        : null;
    if (button === null || ports.busy()) return;
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

  return { settings: chosenSettings, apply, refresh };
}
