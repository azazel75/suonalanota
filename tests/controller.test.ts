/**
 * :Project:  suona-la-nota -- what the exercise screen does, frame by frame
 * :Created:  dom 08 nov 2026 22:50:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The behaviour the ticket asks for, checked without a browser: a target on
 * screen, a pressione judged at once, green on the right key, red on the wrong one,
 * no flash at all when the octave is uncertain, the clock moving the target on,
 * the pause stopping it, and the message that tells a silent room from a
 * wrong note.
 */
import { describe, expect, it } from 'vitest';

import {
  REPEAT_MESSAGE,
  SILENCE_MESSAGE,
  createExercise,
  type HeardPressione,
} from '../src/exercise/controller';
import type { Placement } from '../src/score/staff';

/** A page that only writes down what it was asked to do. */
function recorder() {
  const calls: string[] = [];
  return {
    calls,
    ports: {
      draw: (placement: Placement) => calls.push(`draw:${placement.midi}:${placement.clef}`),
      flash: (verdict: string) => calls.push(`flash:${verdict}`),
      beep: () => calls.push('beep'),
      message: (text: string | null) => calls.push(`message:${text ?? '-'}`),
      status: () => calls.push('status'),
      end: (reason: string) => calls.push(`end:${reason}`),
    },
  };
}

/** One pressione of the listener, as the screen sees it. */
function pressione(midi: number, ambiguous = false): HeardPressione {
  return { midi, ambiguous };
}

/** A frame of silence, at a given instant. */
function quiet(at: number, levelDb = -80) {
  return { at, levelDb, pressioni: [] as HeardPressione[] };
}

/** What a page did, filtered to the calls a test is about. */
function effects(calls: readonly string[], ...prefixes: string[]): string[] {
  return calls.filter((call) => prefixes.some((prefix) => call.startsWith(prefix)));
}

function exercise(keys: number[], config = {}) {
  const { calls, ports } = recorder();
  const started = createExercise({ keys, config, ports });
  return { calls, exercise: started };
}

describe('the exercise screen', () => {
  it('puts the first target on the staff before anything else', () => {
    const { calls } = exercise([60, 62]);
    expect(effects(calls, 'draw')).toEqual(['draw:60:treble']);
  });

  it('turns green, beeps once and moves on when the key is right', () => {
    const { calls, exercise: ex } = exercise([60, 62]);
    ex.feed({ at: 40, levelDb: -20, pressioni: [pressione(60)] });
    expect(effects(calls, 'flash', 'beep', 'draw')).toEqual([
      'draw:60:treble',
      'flash:centered',
      'beep',
      'draw:62:treble',
    ]);
  });

  it('turns red, beeps once and keeps the same target when the key is wrong', () => {
    const { calls, exercise: ex } = exercise([60]);
    ex.feed({ at: 40, levelDb: -20, pressioni: [pressione(61)] });
    expect(effects(calls, 'flash', 'beep', 'draw')).toEqual([
      'draw:60:treble',
      'flash:wrong',
      'beep',
    ]);
    expect(ex.state().current?.wrongHits).toBe(1);
  });

  it('does not flash and does not beep on an ambiguous pressione, but asks for the note again', () => {
    const { calls, exercise: ex } = exercise([60]);
    ex.feed({ at: 40, levelDb: -20, pressioni: [pressione(60, true)] });
    expect(effects(calls, 'flash', 'beep')).toEqual([]);
    expect(effects(calls, 'message')).toEqual([`message:${REPEAT_MESSAGE}`]);
    expect(ex.state().current?.wrongHits).toBe(0);
  });

  it('takes the invitation to repeat away at the next pressione that is judged', () => {
    const { calls, exercise: ex } = exercise([60]);
    ex.feed({ at: 40, levelDb: -20, pressioni: [pressione(60, true)] });
    ex.feed({ at: 80, levelDb: -20, pressioni: [pressione(61)] });
    expect(effects(calls, 'message')).toEqual([`message:${REPEAT_MESSAGE}`, 'message:-']);
  });

  it('moves on when the target time is over, without a verdict of its own', () => {
    const { calls, exercise: ex } = exercise([60, 62]);
    ex.feed(quiet(40));
    ex.feed(quiet(40 + 8_000));
    expect(effects(calls, 'draw')).toEqual(['draw:60:treble', 'draw:62:treble']);
    expect(ex.state().results).toEqual([
      expect.objectContaining({ key: 60, verdict: 'skipped' }),
    ]);
  });

  it('says the session is over and stops drawing targets', () => {
    const { calls, exercise: ex } = exercise([60, 62], { durationMs: 1_000 });
    ex.feed(quiet(40));
    ex.feed(quiet(1_040));
    expect(effects(calls, 'end')).toEqual(['end:duration']);
    ex.feed(quiet(2_000));
    expect(effects(calls, 'draw')).toEqual(['draw:60:treble']);
  });

  it('does not consume the session while paused, and picks the clock up again after', () => {
    const { calls, exercise: ex } = exercise([60, 62], { durationMs: 2_000 });
    ex.feed(quiet(40));
    ex.pause();
    ex.feed(quiet(1_500));
    expect(ex.state().elapsedMs).toBe(0);
    expect(effects(calls, 'draw')).toEqual(['draw:60:treble']);
    ex.resume();
    ex.feed(quiet(1_540));
    expect(ex.state().elapsedMs).toBe(40);
  });

  it('asks about the volume after five seconds of a silent room', () => {
    const { calls, exercise: ex } = exercise([60]);
    ex.feed(quiet(0, -80));
    ex.feed(quiet(4_900, -80));
    expect(effects(calls, 'message')).toEqual([]);
    ex.feed(quiet(5_100, -80));
    expect(effects(calls, 'message')).toEqual([`message:${SILENCE_MESSAGE}`]);
  });

  it('does not ask about the volume when the room is simply quiet but the microphone hears', () => {
    const { calls, exercise: ex } = exercise([60]);
    ex.feed(quiet(0, -30));
    ex.feed(quiet(6_000, -30));
    expect(effects(calls, 'message')).toEqual([]);
  });

  it('drops the volume message at the first pressione', () => {
    const { calls, exercise: ex } = exercise([60]);
    ex.feed(quiet(0, -80));
    ex.feed(quiet(5_100, -80));
    ex.feed({ at: 5_140, levelDb: -20, pressioni: [pressione(61)] });
    expect(effects(calls, 'message')).toEqual([`message:${SILENCE_MESSAGE}`, 'message:-']);
  });

  it('alternates the middle C from one target to the next', () => {
    const { calls, exercise: ex } = exercise([60, 60, 60]);
    ex.feed({ at: 40, levelDb: -20, pressioni: [pressione(60)] });
    ex.feed({ at: 80, levelDb: -20, pressioni: [pressione(60)] });
    expect(effects(calls, 'draw')).toEqual(['draw:60:treble', 'draw:60:bass', 'draw:60:treble']);
  });
});
