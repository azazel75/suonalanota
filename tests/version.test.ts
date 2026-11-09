import { describe, expect, it } from 'vitest';

import { APP_LICENSE, APP_VERSION, SOURCE_URL, aboutText } from '../src/version';

describe('the version of this build', () => {
  it('is the number package.json carries, injected as a literal', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/u);
    expect(__APP_VERSION__).toBe(APP_VERSION);
  });

  it('shows the licence next to it, and points at the sources', () => {
    expect(APP_LICENSE).toBe('GPL-3.0-or-later');
    expect(aboutText()).toBe(`versione ${APP_VERSION} · GPL-3.0-or-later`);
    expect(SOURCE_URL).toBe('https://github.com/azazel75/suonalanota');
  });
});
