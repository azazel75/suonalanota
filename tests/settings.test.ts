/**
 * :Project:  suona-la-nota -- the settings of the trial, checked without a browser
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The settings are the trial: the same tests that say what the defaults are,
 * that the cap reaches the engine, and that a sequence never leaves the range
 * it was built for. The engine tests run the real engine, not a mock of it.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  PRESETS,
  clampRange,
  normalise,
  presetKeys,
  problemWith,
  randomSequence,
  sequenceFor,
  sessionConfigOf,
  settingsFromQuery,
  soundcheckRequired,
  type Settings,
} from '../src/exercise/settings';
import { ADVANCED_RANGE, BASE_RANGE, isInRange, keysInRange } from '../src/score/staff';
import { createSession } from '../src/session/engine';

function settings(changes: Partial<Settings> = {}): Settings {
  return normalise({ ...DEFAULT_SETTINGS, ...changes });
}

describe('the settings of the trial', () => {
  it('starts from the playable defaults the ticket asks for', () => {
    expect(DEFAULT_SETTINGS.range).toEqual(BASE_RANGE);
    expect(DEFAULT_SETTINGS.durationMs).toBe(60_000);
    expect(DEFAULT_SETTINGS.targetTimeoutMs).toBe(8_000);
    expect(DEFAULT_SETTINGS.wrongLimit).toBeNull();
    expect(DEFAULT_SETTINGS.mode).toBe('random');
    expect(problemWith(DEFAULT_SETTINGS)).toBeNull();
    expect(sequenceFor(DEFAULT_SETTINGS)).toHaveLength(keysInRange(BASE_RANGE).length);
  });

  it('draws every key of the range once, and never the same key twice', () => {
    const keys = sequenceFor(settings({ range: ADVANCED_RANGE }), () => 0.42);

    expect(keys).toHaveLength(keysInRange(ADVANCED_RANGE).length);
    expect(new Set(keys)).toEqual(new Set(keysInRange(ADVANCED_RANGE)));
  });

  it('takes its randomness from outside, so a shuffle can be repeated', () => {
    const range = { lowest: 60, highest: 64 };
    const once = randomSequence(range, () => 0);

    expect(randomSequence(range, () => 0)).toEqual(once);
    expect(once).not.toEqual(keysInRange(range));
  });

  it('leaves nothing out of the range it shuffles', () => {
    for (const random of [() => 0, () => 0.5, () => 0.999]) {
      const keys = randomSequence(BASE_RANGE, random);
      expect(keys.filter((key) => isInRange(key, BASE_RANGE))).toHaveLength(keys.length);
      expect(new Set(keys)).toEqual(new Set(keysInRange(BASE_RANGE)));
    }
  });

  it('closes a target at the cap the settings ask for', () => {
    const run = createSession([60], sessionConfigOf(settings({ wrongLimit: 1 })));

    expect(run.hit(61)).toEqual({ kind: 'verdict', verdict: 'wrong' });
  });

  it('leaves the cap off only when the settings say off', () => {
    expect(settings({ wrongLimit: null }).wrongLimit).toBeNull();
    // A ticked checkbox with an empty field is a cap of one, not a silent "off".
    expect(settings({ wrongLimit: 0 }).wrongLimit).toBe(1);
    expect(settings({ wrongLimit: -3 }).wrongLimit).toBe(1);
    expect(settings({ wrongLimit: 2.7 }).wrongLimit).toBe(2);

    const run = createSession([60], sessionConfigOf(settings()));
    expect(run.hit(61)).toEqual({ kind: 'wrong' });
  });

  it('carries duration and time per target into the engine', () => {
    const config = sessionConfigOf(settings({ durationMs: 30_000, targetTimeoutMs: 5_000 }));

    expect(config.durationMs).toBe(30_000);
    expect(config.targetTimeoutMs).toBe(5_000);
  });

  it('puts an empty or impossible range back in order and inside the piano', () => {
    expect(clampRange(72, 48)).toEqual({ lowest: 48, highest: 72 });
    expect(clampRange(10, 500)).toEqual({ lowest: 21, highest: 108 });
    expect(clampRange(60.4, 59.6)).toEqual({ lowest: 60, highest: 60 });
  });

  it('falls back to the default clocks when a control says zero', () => {
    expect(settings({ durationMs: 0 }).durationMs).toBe(60_000);
    expect(settings({ targetTimeoutMs: 0 }).targetTimeoutMs).toBe(8_000);
    expect(settings({ durationMs: 45_000 }).durationMs).toBe(45_000);
  });

  it('ships presets inside the base range, without repeats, and they play to the end', () => {
    expect(PRESETS).toHaveLength(3);
    for (const preset of PRESETS) {
      expect(preset.name).not.toBe('');
      expect(preset.keys.length).toBeGreaterThan(0);
      expect(new Set(preset.keys).size).toBe(preset.keys.length);
      for (const key of preset.keys) expect(isInRange(key, BASE_RANGE)).toBe(true);
    }

    const preset = PRESETS[0];
    const keys = presetKeys(settings({ mode: 'preset', presetId: preset.id }));
    const run = createSession(keys);
    for (const key of keys) run.hit(key);

    expect(run.state().finished).toBe(true);
    expect(run.state().endReason).toBe('targets');
    expect(run.state().score.centered).toBe(keys.length);
  });

  it('filters a preset on the range in force, and says so when nothing is left', () => {
    expect(sequenceFor(settings({ mode: 'preset', range: { lowest: 60, highest: 60 } }))).toEqual([60]);

    const nothing = settings({ mode: 'preset', presetId: 'rigo-di-basso', range: { lowest: 60, highest: 72 } });
    expect(sequenceFor(nothing)).toEqual([]);
    expect(problemWith(nothing)).toContain("nell'intervallo");
  });

  it('plays the list in the order it was composed, dropping what is out of range', () => {
    const withList = settings({ mode: 'list', list: [64, 62, 60, 108, 20] });

    expect(sequenceFor(withList)).toEqual([64, 62, 60]);
    expect(problemWith({ ...withList, list: [] })).toContain('lista');
  });

  it('does not call a list empty when it is only out of the range in force', () => {
    const outside = settings({ mode: 'list', list: [90, 91], range: { lowest: 48, highest: 72 } });

    expect(problemWith(outside)).toContain("nell'intervallo");
    expect(problemWith(outside)).not.toContain('vuota');
  });
});

describe('the trial from the URL', () => {
  const params = (query: string): URLSearchParams => new URLSearchParams(query);

  it('leaves the defaults alone when the URL says nothing', () => {
    const fromUrl = settingsFromQuery(params(''));

    expect(fromUrl.settings).toEqual(DEFAULT_SETTINGS);
    expect(fromUrl.skipSetup).toBe(false);
  });

  it('reads duration and time per target in seconds', () => {
    const { settings } = settingsFromQuery(params('duration=30&timeout=5'));

    expect(settings.durationMs).toBe(30_000);
    expect(settings.targetTimeoutMs).toBe(5_000);
  });

  it('takes a preset range, then the ends the URL overrides', () => {
    expect(settingsFromQuery(params('range=advanced')).settings.range).toEqual(ADVANCED_RANGE);
    expect(settingsFromQuery(params('range=advanced&lowest=60')).settings.range)
      .toEqual({ lowest: 60, highest: ADVANCED_RANGE.highest });
    expect(settingsFromQuery(params('lowest=70&highest=50')).settings.range)
      .toEqual({ lowest: 50, highest: 70 });
  });

  it('reads the cap, the mode and the preset', () => {
    const { settings } = settingsFromQuery(params('cap=2&mode=preset&preset=due-chiavi'));

    expect(settings.wrongLimit).toBe(2);
    expect(settings.mode).toBe('preset');
    expect(settings.presetId).toBe('due-chiavi');
    expect(sequenceFor(settings)).toHaveLength(14);
  });

  it('reads a cap below one as no cap, because a link has no checkbox to tick', () => {
    expect(settingsFromQuery(params('cap=0')).settings.wrongLimit).toBeNull();
    expect(settingsFromQuery(params('cap=-2')).settings.wrongLimit).toBeNull();
    expect(settingsFromQuery(params('cap=3')).settings.wrongLimit).toBe(3);
  });

  it('keeps the defaults for what it cannot read, but skips the confirmation anyway', () => {
    const { settings, skipSetup } = settingsFromQuery(
      params('range=xyz&duration=molto&mode=boh&preset=due-chiave'),
    );

    expect(settings.range).toEqual(BASE_RANGE);
    expect(settings.durationMs).toBe(60_000);
    expect(settings.mode).toBe('random');
    // A typo in a preset id must not land on the staff with nothing to ask.
    expect(settings.presetId).toBe(DEFAULT_SETTINGS.presetId);
    expect(problemWith(settings)).toBeNull();
    expect(skipSetup).toBe(true);
  });

  it('skips the configuration screen only when the URL chose something', () => {
    expect(settingsFromQuery(params('duration=30')).skipSetup).toBe(true);
    expect(settingsFromQuery(params('nonsense=1')).skipSetup).toBe(false);
    expect(settingsFromQuery(params('autostart=1')).skipSetup).toBe(false);
  });

  it('lets the soundcheck be required without skipping the trial it is asked from', () => {
    // `?soundcheck=1` opens the configuration and, from there, the device sensitivity; it
    // is not a trial parameter, and treating it as one would skip the very
    // screen it lives on.
    expect(settingsFromQuery(params('soundcheck=1')).skipSetup).toBe(false);
    expect(settingsFromQuery(params('soundcheck=1&duration=30')).skipSetup).toBe(true);
    expect(soundcheckRequired(params('soundcheck=1'))).toBe(true);
    expect(soundcheckRequired(params('soundcheck=0'))).toBe(false);
    expect(soundcheckRequired(params(''))).toBe(false);
  });
});
