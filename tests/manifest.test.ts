import { describe, expect, it } from 'vitest';

import {
  MANIFEST,
  MANIFEST_LIGHT,
  MANIFEST_LIGHT_PATH,
  MANIFEST_PATH,
  manifestJson,
} from '../src/pwa/manifest';
import { manifestHrefFor } from '../src/pwa/manifest-theme';

describe('the manifest of the installed application', () => {
  it('is emitted at the two paths the page chooses between', () => {
    expect(MANIFEST_PATH).toBe('/manifest.json');
    expect(MANIFEST_LIGHT_PATH).toBe('/manifest-light.json');
    expect(manifestHrefFor(false)).toBe(MANIFEST_PATH);
    expect(manifestHrefFor(true)).toBe(MANIFEST_LIGHT_PATH);
  });

  it('carries the splash colour of its own palette, not of the other one', () => {
    expect(MANIFEST.background_color).toBe('#0b0f14');
    expect(MANIFEST.theme_color).toBe('#0b0f14');
    expect(MANIFEST_LIGHT.background_color).toBe('#f4f2ec');
    expect(MANIFEST_LIGHT.theme_color).toBe('#f4f2ec');
  });

  it('describes the same application in both palettes', () => {
    const dark = JSON.parse(manifestJson()) as Record<string, unknown>;
    const light = JSON.parse(manifestJson('light')) as Record<string, unknown>;

    for (const key of [
      'name',
      'short_name',
      'description',
      'lang',
      'start_url',
      'scope',
      'display',
      'icons',
    ]) {
      expect(light[key]).toEqual(dark[key]);
    }
  });

  it('keeps the dark one as the default, for a page that never runs the script', () => {
    expect(manifestJson()).toBe(manifestJson('dark'));
    expect(MANIFEST.icons[0].sizes).toBe('192x192');
  });
});
