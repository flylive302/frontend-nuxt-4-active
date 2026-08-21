import { describe, expect, it } from 'vitest';
import { resolveMiceWaveRingColor } from '~/utils/mice-wave-ring-color';
import { DEFAULT_SPEAKING_RING_COLOR } from '~/constants/room';

// svga-removal 01: pure resolver — color present, absent, malformed.

describe('resolveMiceWaveRingColor', () => {
  it('returns the metadata color when present and valid (hex)', () => {
    expect(resolveMiceWaveRingColor({ color: '#00ff00' })).toBe('#00ff00');
  });

  it('returns the metadata color when present and valid (rgb function)', () => {
    expect(resolveMiceWaveRingColor({ color: 'rgba(0, 255, 0, 0.5)' })).toBe('rgba(0, 255, 0, 0.5)');
  });

  it('falls back to the default when metadata is absent', () => {
    expect(resolveMiceWaveRingColor(undefined)).toBe(DEFAULT_SPEAKING_RING_COLOR);
    expect(resolveMiceWaveRingColor(null)).toBe(DEFAULT_SPEAKING_RING_COLOR);
  });

  it('falls back to the default when metadata has no color key', () => {
    expect(resolveMiceWaveRingColor({})).toBe(DEFAULT_SPEAKING_RING_COLOR);
    expect(resolveMiceWaveRingColor({ other: 'value' })).toBe(DEFAULT_SPEAKING_RING_COLOR);
  });

  it('falls back to the default when color is not a recognizable CSS color', () => {
    expect(resolveMiceWaveRingColor({ color: 'notacolor' })).toBe(DEFAULT_SPEAKING_RING_COLOR);
  });

  it('falls back to the default when color is an injection-shaped string', () => {
    expect(resolveMiceWaveRingColor({ color: 'red; background: url(x)' })).toBe(DEFAULT_SPEAKING_RING_COLOR);
  });

  it('falls back to the default when color is not a string', () => {
    expect(resolveMiceWaveRingColor({ color: 123 })).toBe(DEFAULT_SPEAKING_RING_COLOR);
    expect(resolveMiceWaveRingColor({ color: null })).toBe(DEFAULT_SPEAKING_RING_COLOR);
  });

  it('falls back to the default when metadata itself is not an object', () => {
    expect(resolveMiceWaveRingColor('color: red')).toBe(DEFAULT_SPEAKING_RING_COLOR);
    expect(resolveMiceWaveRingColor(42)).toBe(DEFAULT_SPEAKING_RING_COLOR);
  });
});
