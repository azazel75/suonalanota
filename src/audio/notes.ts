/**
 * :Project:  suona-la-nota -- names and frequencies of the piano keys
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 */

/** MIDI number of the piano's lowest key (A0). */
export const LOWEST_MIDI = 21;

/** MIDI number of the piano's highest key (C8). */
export const HIGHEST_MIDI = 108;

/** Standard pitch: A4 has MIDI number 69. */
export const A4_MIDI = 69;

export const A4_HZ = 440;

const SCIENTIFIC_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#',
  'G', 'G#', 'A', 'A#', 'B',
];

const ITALIAN_NAMES = [
  'Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯',
  'Sol', 'Sol♯', 'La', 'La♯', 'Si',
];

/** Frequency in Hz of a MIDI note, equal temperament. */
export function midiToHz(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Nearest MIDI note of a frequency, as a fractional number. */
export function hzToMidi(hz: number): number {
  return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

/** Position of a MIDI note inside its octave: 0 is C. */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** Scientific octave number: C4 is the middle C. */
export function octave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** The note name in the scientific convention, e.g. `C4`, `A#3`. */
export function midiToName(midi: number): string {
  return `${SCIENTIFIC_NAMES[pitchClass(midi)]}${octave(midi)}`;
}

/** The note name in Italian solfège, e.g. `Do4`, `La♯3`. */
export function midiToItalian(midi: number): string {
  return `${ITALIAN_NAMES[pitchClass(midi)]}${octave(midi)}`;
}

/** Both names, because a teacher in Italy reads the second one. */
export function midiToLabel(midi: number): string {
  return `${midiToItalian(midi)} (${midiToName(midi)})`;
}

/** Whether a MIDI number is one of the 88 keys of a piano. */
export function isPianoKey(midi: number): boolean {
  return midi >= LOWEST_MIDI && midi <= HIGHEST_MIDI;
}

/** Whether two MIDI numbers name the same key. */
export function sameKey(a: number, b: number): boolean {
  return Math.round(a) === Math.round(b);
}

/** Every key of the piano, lowest first. */
export function pianoKeys(): number[] {
  const keys: number[] = [];
  for (let midi = LOWEST_MIDI; midi <= HIGHEST_MIDI; midi++) keys.push(midi);
  return keys;
}
