import { describe, expect, it } from 'vitest';
import { resolveClientPlatform } from '~/utils/client-platform';

// observability-audio-quality/07 — the whole truth table. Capacitor's
// `getPlatform()` is typed as a bare `string`, so the domain is open at the
// type level and the fallback case is part of the contract, not defensive
// padding.
describe('resolveClientPlatform', () => {
  it('resolves the Android native shell', () => {
    expect(resolveClientPlatform('android')).toBe('android');
  });

  it('resolves the iOS native shell', () => {
    // No iOS target ships today. This case exists so that adding one tags
    // iOS events `ios` rather than silently labelling them `android`.
    expect(resolveClientPlatform('ios')).toBe('ios');
  });

  it('resolves the browser', () => {
    expect(resolveClientPlatform('web')).toBe('web');
  });

  it('buckets an unrecognised platform id as unknown, never as web', () => {
    // A future Capacitor platform must not be silently counted as a browser —
    // that would inflate the web numbers with native traffic.
    expect(resolveClientPlatform('electron')).toBe('unknown');
    expect(resolveClientPlatform('')).toBe('unknown');
  });
});
