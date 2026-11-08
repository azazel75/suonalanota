/**
 * :Project:  suona-la-nota -- probe 1: the odd partials of the octave below
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The question: when the detector names a note and its octave is almost as
 * strong, was the octave really played (odd partials present) or is it a string
 * resonating in its even mode (odd partials absent)?
 *
 * Reads the spectrum about 140 ms after the attack: settled enough to be stable,
 * early enough that the odd partials have not decayed away yet.
 */
import { partialProfile } from '../audio/profile';
import { runProbe } from './probe';

function round(value: number, digits = 3): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

runProbe({
  name: 'dispari',
  columns: [
    ['oddEvenLower', 'disp/pari grave'],
    ['oddEvenWinner', 'disp/pari acuta'],
    ['lowerOdd', 'dispari grave'],
    ['winnerOdd', 'dispari acuta'],
    ['octaveMarginDb', 'margine ottava'],
  ],
  measure({ detection, sampleRate, series }) {
    const winner = detection.best.midi;
    const lower = winner - 12;
    const settled = series[Math.min(series.length - 1, Math.round(series.length * 0.55))];
    const magnitudes = settled ?? series[series.length - 1];

    const upperProfile = partialProfile(magnitudes, sampleRate, winner);
    const lowerProfile = lower >= 21
      ? partialProfile(magnitudes, sampleRate, lower)
      : null;

    return {
      winnerMidi: winner,
      lowerMidi: lower,
      octaveMarginDb: round(detection.octaveMarginDb, 1),
      ambiguous: detection.ambiguous,
      winnerFundamental: round(upperProfile.fundamental, 5),
      winnerOdd: round(upperProfile.odd, 5),
      winnerEven: round(upperProfile.even, 5),
      oddEvenWinner: round(upperProfile.oddToEven, 3),
      lowerFundamental: lowerProfile ? round(lowerProfile.fundamental, 5) : null,
      lowerOdd: lowerProfile ? round(lowerProfile.odd, 5) : null,
      lowerEven: lowerProfile ? round(lowerProfile.even, 5) : null,
      oddEvenLower: lowerProfile ? round(lowerProfile.oddToEven, 3) : null,
    };
  },
});
