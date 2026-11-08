/**
 * :Project:  suona-la-nota -- the exercise screen, one target at a time
 * :Created:  dom 08 nov 2026 22:25:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The page wiring of the exercise screen: pick a key of the active range, let
 * the map in ./score/staff decide how it is written, and hand that to the
 * drawing in ./score/sheet. One target, no keyboard, no name of the note: the
 * map between staff and key is the exercise, and showing the answer would
 * cancel it.
 */
import { midiToItalian } from './audio/notes';
import { drawTarget } from './score/sheet';
import {
  ADVANCED_RANGE,
  BASE_RANGE,
  equallyNearInBothClefs,
  keysInRange,
  nearestPlacement,
  type Clef,
  type KeyRange,
} from './score/staff';

/** The clef of the last middle C drawn: that position alternates between the two. */
let lastMiddleCClef: Clef | undefined;

/** The last key asked for, so that the same one does not come twice in a row. */
let lastKey: number | null = null;

function nextKey(range: KeyRange): number {
  const keys = keysInRange(range);
  const candidates = keys.length > 1 && lastKey !== null ? keys.filter((key) => key !== lastKey) : keys;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Ask the map for the next target and put it on the staff. */
function showTarget(range: KeyRange): void {
  const host = document.querySelector<HTMLDivElement>('#target');
  if (host === null) return;

  const midi = nextKey(range);
  const placement = nearestPlacement(midi, lastMiddleCClef);
  // Only the middle C position reads the previous clef, and only it has to be
  // remembered: everywhere else the key alone decides.
  if (equallyNearInBothClefs(midi)) lastMiddleCClef = placement.clef;
  lastKey = midi;
  drawTarget(host, placement);
}

function currentRange(): KeyRange {
  const chosen = document.querySelector<HTMLInputElement>('input[name="range"]:checked');
  return chosen !== null && chosen.value === 'advanced' ? ADVANCED_RANGE : BASE_RANGE;
}

function showRange(range: KeyRange): void {
  const label = document.getElementById('range-label');
  if (label !== null) label.textContent = `${midiToItalian(range.lowest)}–${midiToItalian(range.highest)}`;
}

async function start(): Promise<void> {
  await document.fonts.ready;

  document.getElementById('next')?.addEventListener('click', () => showTarget(currentRange()));

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="range"]')) {
    input.addEventListener('change', () => {
      const range = currentRange();
      // A new range is a new sequence: nothing carried over from the old one.
      lastKey = null;
      showRange(range);
      showTarget(range);
    });
  }

  showRange(currentRange());
  showTarget(currentRange());
}

void start();
