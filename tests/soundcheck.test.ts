/**
 * :Project:  suona-la-nota -- the five notes of the soundcheck
 * :Created:  lun 09 nov 2026 01:40:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The soundcheck asks five things: the instrument's lowest key and its
 * highest, then the same two again for the portata, then the middle C as a
 * control. What it can decide from them — the interval the device hears, a key
 * it is systematically unsure about, a room that never made a sound — is here,
 * without a microphone and without a screen.
 */
import { describe, expect, it } from 'vitest';

import {
  PROBES,
  createSoundcheck,
  type SoundcheckPressione,
  type SoundcheckOptions,
} from '../src/exercise/soundcheck';
import { PORTATA_VERSION } from '../src/exercise/portata';

const WHEN = new Date('2026-11-09T10:00:00.000Z');

/** Six seconds per note is the ticket's thirty seconds, once the microphone is open. */
const TIMEOUT = 6_000;

/** A microphone frame with a level and, sometimes, the pressioni it completed. */
function frame(levelDb: number, pressioni: readonly SoundcheckPressione[] = []) {
  return { levelDb, pressioni };
}

/** A pressione the detector was sure of. */
function heard(midi: number): SoundcheckPressione {
  return { midi, ambiguous: false };
}

/** A pressione whose octave the detector could not decide. */
function ambiguous(midi: number): SoundcheckPressione {
  return { midi, ambiguous: true };
}

function soundcheck(options: Partial<SoundcheckOptions> = {}) {
  const check = createSoundcheck({ when: WHEN, timeoutMs: TIMEOUT, ...options });
  check.start(0);
  return check;
}

/** Plays one credible note on the current probe. */
function play(check: ReturnType<typeof soundcheck>, midi: number, at: number): void {
  check.feed(at, frame(-20, [heard(midi)]));
}

/** Runs the whole protocol with the notes a test wants heard. */
function playThrough(
  check: ReturnType<typeof soundcheck>,
  notes: readonly (number | null)[],
): void {
  let at = 0;
  notes.forEach((midi, index) => {
    at += 100;
    if (midi === null) check.feed(at + TIMEOUT, frame(-20));
    else play(check, midi, at);
    expect(check.snapshot().index).toBe(Math.min(index + 2, PROBES.length));
  });
}

describe('the five probes', () => {
  it('asks the extremes, then the extremes again, then the middle C', () => {
    const check = createSoundcheck({ when: WHEN, timeoutMs: TIMEOUT });
    expect(check.snapshot().probe).toBeNull();
    check.start(0);
    expect(check.snapshot().probe).toBe('basso');
    play(check, 36, 100);
    expect(check.snapshot().probe).toBe('alto');
    play(check, 84, 200);
    expect(check.snapshot().probe).toBe('basso2');
    play(check, 36, 300);
    expect(check.snapshot().probe).toBe('alto2');
    play(check, 84, 400);
    expect(check.snapshot().probe).toBe('centrale');
    play(check, 60, 500);
    expect(check.snapshot().probe).toBeNull();
    expect(check.snapshot().finished).toBe(true);
  });

  it('counts them from one to five and then stops counting', () => {
    const check = createSoundcheck({ when: WHEN, timeoutMs: TIMEOUT });
    check.start(0);
    playThrough(check, [36, 84, 36, 84, 60]);
    expect(check.snapshot().index).toBe(PROBES.length);
  });

  it('ignores frames before the microphone is open', () => {
    const check = createSoundcheck({ when: WHEN, timeoutMs: TIMEOUT });
    check.feed(100, frame(-20, [heard(36)]));
    expect(check.snapshot().probe).toBeNull();
    expect(check.snapshot().heard.size).toBe(0);
  });
});

describe('what one probe can produce', () => {
  it('records the key a credible pressione named', () => {
    const check = soundcheck();
    play(check, 36, 100);
    expect(check.snapshot().heard.get('basso')).toBe(36);
  });

  it('takes the lowest of the two bass probes, not the last one', () => {
    const check = soundcheck();
    playThrough(check, [40, 84, 36, 84, 60]);
    expect(check.snapshot().portata?.sente.lowest).toBe(36);
  });

  it('takes the highest of the two treble probes', () => {
    const check = soundcheck();
    playThrough(check, [36, 80, 36, 84, 60]);
    expect(check.snapshot().portata?.sente.highest).toBe(84);
  });

  it('gives up on a key after three ambiguous pressioni in a row', () => {
    const check = soundcheck();
    check.feed(100, frame(-20, [ambiguous(36)]));
    check.feed(200, frame(-20, [ambiguous(36)]));
    expect(check.snapshot().probe).toBe('basso');
    check.feed(300, frame(-20, [ambiguous(36)]));
    expect(check.snapshot().excluded).toEqual([36]);
    expect(check.snapshot().probe).toBe('alto');
  });

  it('does not give up on a key the detector then reads clearly', () => {
    const check = soundcheck();
    check.feed(100, frame(-20, [ambiguous(36)]));
    check.feed(200, frame(-20, [ambiguous(36)]));
    check.feed(300, frame(-20, [heard(36)]));
    expect(check.snapshot().excluded).toEqual([]);
    expect(check.snapshot().heard.get('basso')).toBe(36);
  });

  it('does not give up on a key whose ambiguous pressioni were not consecutive', () => {
    const check = soundcheck();
    check.feed(100, frame(-20, [ambiguous(36)]));
    check.feed(200, frame(-20, [ambiguous(48)]));
    check.feed(300, frame(-20, [ambiguous(36)]));
    expect(check.snapshot().excluded).toEqual([]);
    expect(check.snapshot().probe).toBe('basso');
  });
});

describe('the clock on each probe', () => {
  it('moves on, unheard, when the time runs out', () => {
    const check = soundcheck();
    check.feed(0, frame(-20));
    check.feed(TIMEOUT - 1, frame(-20));
    expect(check.snapshot().probe).toBe('basso');
    check.feed(TIMEOUT, frame(-20));
    expect(check.snapshot().probe).toBe('alto');
    expect(check.snapshot().heard.size).toBe(0);
  });

  it('does not blame the volume while the room has been loud', () => {
    const check = soundcheck();
    check.feed(0, frame(-90));
    check.feed(100, frame(-40));
    check.feed(TIMEOUT, frame(-40));
    expect(check.snapshot().silent).toBe(false);
    expect(check.snapshot().finished).toBe(false);
    expect(check.snapshot().probe).toBe('alto');
  });
});

describe('a room that never made a sound', () => {
  it('gives the first quiet note a second chance', () => {
    const check = soundcheck();
    check.feed(0, frame(-90));
    check.feed(TIMEOUT, frame(-90));
    expect(check.snapshot().silent).toBe(false);
    expect(check.snapshot().finished).toBe(false);
    expect(check.snapshot().probe).toBe('alto');
  });

  it('says to check the volume when two notes in a row make no sound', () => {
    const check = soundcheck();
    check.feed(0, frame(-90));
    check.feed(TIMEOUT, frame(-90));
    check.feed(TIMEOUT * 2, frame(-90));
    expect(check.snapshot().silent).toBe(true);
    expect(check.snapshot().finished).toBe(true);
    expect(check.snapshot().probe).toBeNull();
  });

  it('does not call a slow hand a muted phone', () => {
    const check = soundcheck();
    check.feed(0, frame(-90));
    check.feed(TIMEOUT, frame(-90));
    play(check, 84, TIMEOUT + 100);
    expect(check.snapshot().silent).toBe(false);
    expect(check.snapshot().heard.get('alto')).toBe(84);
    expect(check.snapshot().probe).toBe('basso2');
  });
});

describe('the measurement the probes add up to', () => {
  it('is the interval between the outermost keys the device heard', () => {
    const check = soundcheck();
    playThrough(check, [36, 84, 36, 84, 60]);
    const portata = check.snapshot().portata;
    expect(portata?.versione).toBe(PORTATA_VERSION);
    expect(portata?.sente).toEqual({ lowest: 36, highest: 84 });
    expect(portata?.quando).toBe(WHEN.toISOString());
  });

  it('falls back to the middle C on a side nobody heard', () => {
    const check = soundcheck();
    playThrough(check, [null, 84, null, 84, 60]);
    expect(check.snapshot().portata?.sente).toEqual({ lowest: 60, highest: 84 });
  });

  it('refuses a measurement whose middle C was never heard', () => {
    const check = soundcheck();
    playThrough(check, [36, 84, 36, 84, null]);
    expect(check.snapshot().finished).toBe(true);
    expect(check.snapshot().portata).toBeNull();
  });

  it('refuses a measurement whose middle C the detector kept confusing', () => {
    const confused = createSoundcheck({ when: WHEN, timeoutMs: TIMEOUT });
    confused.start(0);
    play(confused, 36, 100);
    play(confused, 84, 200);
    play(confused, 36, 300);
    play(confused, 84, 400);
    expect(confused.snapshot().probe).toBe('centrale');

    confused.feed(1_000, frame(-20, [ambiguous(60)]));
    confused.feed(1_100, frame(-20, [ambiguous(60)]));
    confused.feed(1_200, frame(-20, [ambiguous(60)]));
    expect(confused.snapshot().excluded).toContain(60);
    expect(confused.snapshot().finished).toBe(true);
    expect(confused.snapshot().portata).toBeNull();
  });

  it('refuses a measurement whose two ends crossed', () => {
    // The allievə played the top key where the bottom one was asked, and the
    // other way round: min/max would turn that into a plausible Do5–Do3.
    const check = soundcheck();
    playThrough(check, [72, 48, 72, 48, 60]);
    expect(check.snapshot().finished).toBe(true);
    expect(check.snapshot().portata).toBeNull();
  });

  it('stops listening once it is finished', () => {
    const check = soundcheck();
    playThrough(check, [36, 84, 36, 84, 60]);
    const before = check.snapshot().portata;
    check.feed(10_000, frame(-20, [heard(48)]));
    expect(check.snapshot().portata).toEqual(before);
    expect(check.snapshot().heard.get('basso')).toBe(36);
  });
});
