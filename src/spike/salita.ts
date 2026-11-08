/**
 * :Project:  suona-la-nota -- probe 2: when each band rises
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The question: a struck string starts in a few milliseconds, a sympathetic
 * resonance builds over tens. If the band of the octave below rises *after* the
 * band of the winner, the octave below was not played — it resonated.
 *
 * The whole series is written to the log, so the discriminant can be re-derived
 * afterwards instead of trusted.
 */
import { bandEnergy, halfRiseMs, riseDelayMs } from '../audio/profile';
import { midiToHz } from '../audio/notes';
import { OCTAVE_PROBE_NOTES, runProbe } from './probe';

const HOP_MS = 20;

function round(value: number, digits = 3): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

runProbe({
  name: 'salita',
  notes: OCTAVE_PROBE_NOTES,
  columns: [
    ['riseDelayMs', 'ritardo grave (ms)'],
    ['lowerRiseMs', 'salita grave'],
    ['upperRiseMs', 'salita acuta'],
    ['octaveMarginDb', 'margine ottava'],
  ],
  measure({ detection, sampleRate, series }) {
    const winner = detection.best.midi;
    const lower = winner - 12;
    const upperBand = series.map((magnitudes) => bandEnergy(magnitudes, sampleRate, midiToHz(winner)));
    const lowerBand = lower >= 21
      ? series.map((magnitudes) => bandEnergy(magnitudes, sampleRate, midiToHz(lower)))
      : [];

    const upperRise = halfRiseMs(upperBand, HOP_MS);
    const lowerRise = lower < 21 ? Number.NaN : halfRiseMs(lowerBand, HOP_MS);
    const delay = lower < 21 ? Number.NaN : riseDelayMs(lowerBand, upperBand, HOP_MS);

    return {
      winnerMidi: winner,
      lowerMidi: lower,
      octaveMarginDb: round(detection.octaveMarginDb, 1),
      ambiguous: detection.ambiguous,
      hopMs: HOP_MS,
      upperRiseMs: upperRise,
      lowerRiseMs: lowerRise,
      riseDelayMs: Number.isNaN(delay) ? null : delay,
      upperBand: upperBand.map((value) => round(value, 6)),
      lowerBand: lowerBand.map((value) => round(value, 6)),
    };
  },
});
