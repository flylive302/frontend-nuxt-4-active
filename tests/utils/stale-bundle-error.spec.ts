import { describe, it, expect } from 'vitest';
import { isStaleBundleError } from '~/utils/stale-bundle-error';

describe('isStaleBundleError', () => {
  describe('matches stale-bundle failures', () => {
    // The exact vue-router message behind Sentry JAVASCRIPT-VUE-5Y. This one is
    // the reason the matcher exists: Nuxt's `app:chunkError` never fires for it,
    // so it reaches us only via `router.onError`.
    it('matches vue-router component resolution failure', () => {
      expect(
        isStaleBundleError(new Error(`Couldn't resolve component "default" at "/room/:id()"`)),
      ).toBe(true);
    });

    it.each([
      ['Chromium', 'Failed to fetch dynamically imported module: https://x/_nuxt/a.js'],
      ['Firefox', 'error loading dynamically imported module'],
      ['Safari', 'Importing a module script failed.'],
      ['CSS preload', 'Unable to preload CSS for /_nuxt/a.css'],
    ])('matches the %s dynamic-import phrasing', (_engine, message) => {
      expect(isStaleBundleError(new Error(message))).toBe(true);
    });
  });

  describe('does NOT match application errors', () => {
    // A false positive is worse than a false negative: reloading on an app error
    // traps the user in a loop they cannot escape.
    it.each([
      ['a generic runtime error', new Error('Cannot read properties of null')],
      ['a network failure', new Error('Network request failed')],
      ['an auth failure', new Error('Unauthorized')],
      ['an empty message', new Error('')],
    ])('ignores %s', (_label, error) => {
      expect(isStaleBundleError(error)).toBe(false);
    });
  });

  describe('tolerates non-Error inputs', () => {
    // Router and window error hooks make no type guarantees.
    it('stringifies a matching plain string', () => {
      expect(isStaleBundleError("Couldn't resolve component \"default\"")).toBe(true);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a number', 42],
      ['an empty object', {}],
    ])('returns false for %s without throwing', (_label, value) => {
      expect(() => isStaleBundleError(value)).not.toThrow();
      expect(isStaleBundleError(value)).toBe(false);
    });
  });
});
