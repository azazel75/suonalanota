/**
 * :Project:  suona-la-nota -- the one sound the application makes
 * :Created:  dom 08 nov 2026 23:05:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * A pressione is judged by a colour and by this: one short neutral tone, the same
 * for a right key and a wrong one. The exercise never plays the note it asks
 * for — that would be the answer — and it never lets the sound say what the
 * colour says, or the ear would learn the exercise instead of the staff.
 *
 * The tone is deliberately quiet: it comes out of the same phone that is
 * listening, and the page drops the pressioni it produces (see main.ts).
 */

/** 660 Hz, an E: inside the exercise range, and no easier to mistake for a note. */
const BEEP_HZ = 660;

const BEEP_SECONDS = 0.06;

/** About -26 dBFS at full scale: audible in a room, not a note. */
const BEEP_GAIN = 0.05;

/** How long the tone takes to come in and go out, so it does not click. */
const RAMP_SECONDS = 0.005;

export interface Speaker {
  /** Play the neutral tone once. */
  beep(): void;
}

export function createSpeaker(context: AudioContext): Speaker {
  return {
    beep(): void {
      const at = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = BEEP_HZ;

      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(BEEP_GAIN, at + RAMP_SECONDS);
      gain.gain.linearRampToValueAtTime(0, at + BEEP_SECONDS);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + BEEP_SECONDS + RAMP_SECONDS);
    },
  };
}
