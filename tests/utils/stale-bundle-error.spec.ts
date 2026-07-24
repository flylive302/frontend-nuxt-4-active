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

    // Sentry JAVASCRIPT-VUE-6G. Nuxt's route-middleware loader does
    // `await Vf[name]?.().then(E => E.default || E)`, so a stale import that
    // resolves `undefined` throws on `.default` and produces none of the
    // phrasings above — the user dead-ended on the route with no reload.
    it.each([
      ['Chromium', "Cannot read properties of undefined (reading 'default')"],
      ['Safari', "undefined is not an object (evaluating 'E.default')"],
    ])('matches the %s middleware-import failure', (_engine, message) => {
      expect(isStaleBundleError(new Error(message))).toBe(true);
    });

    // The object identifier is minified and changes every build, so the matcher
    // must key on the property name alone. If this ever regresses to including
    // the identifier, this case is what catches it.
    it('still matches when the minified identifier differs', () => {
      expect(
        isStaleBundleError(new Error("undefined is not an object (evaluating 'qZ.default')")),
      ).toBe(true);
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
