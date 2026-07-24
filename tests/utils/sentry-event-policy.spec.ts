import { describe, it, expect } from 'vitest';
import { applySentryEventPolicy } from '~/utils/sentry-event-policy';

describe('applySentryEventPolicy', () => {
  describe('PII scrubbing', () => {
    it('keeps only user.id', () => {
      const event = {
        user: { id: 42, email: 'a@b.c', ip_address: '1.2.3.4', username: 'x' },
      } as Parameters<typeof applySentryEventPolicy>[0];

      expect(applySentryEventPolicy(event).user).toEqual({ id: 42 });
    });

    it('leaves an event with no user untouched', () => {
      expect(applySentryEventPolicy({}).user).toBeUndefined();
    });
  });

  describe('recovered tagging', () => {
    // Stale-bundle errors are auto-recovered by plugins/chunk-reload.client.ts,
    // but still reported — and re-fingerprinted every deploy because the chunk
    // filename is content-hashed. The tag is what lets the stream filter them.
    it('tags a stale-bundle error from hint.originalException', () => {
      const event = applySentryEventPolicy(
        {},
        { originalException: new Error(`Couldn't resolve component "default" at "/mall"`) },
      );

      expect(event.tags?.recovered).toBe('true');
    });

    it('tags the middleware-loader failure behind JAVASCRIPT-VUE-6G', () => {
      const event = applySentryEventPolicy(
        {},
        { originalException: new Error("Cannot read properties of undefined (reading 'default')") },
      );

      expect(event.tags?.recovered).toBe('true');
    });

    // Events can arrive without an originalException; the serialised message is
    // the only signal left, so the fallback has to work.
    it('falls back to the serialised exception message', () => {
      const event = applySentryEventPolicy({
        exception: { values: [{ value: 'Failed to fetch dynamically imported module: /_nuxt/a.js' }] },
      });

      expect(event.tags?.recovered).toBe('true');
    });

    it('does NOT tag an ordinary application error', () => {
      const event = applySentryEventPolicy(
        {},
        { originalException: new Error('Cannot read properties of null (reading "id")') },
      );

      expect(event.tags?.recovered).toBeUndefined();
    });

    it('does not clobber pre-existing tags', () => {
      const event = applySentryEventPolicy(
        { tags: { route: '/mall' } },
        { originalException: new Error('Unable to preload CSS for /_nuxt/a.css') },
      );

      expect(event.tags).toEqual({ route: '/mall', recovered: 'true' });
    });
  });

  it('applies both policies to the same event', () => {
    const event = applySentryEventPolicy(
      { user: { id: 7, email: 'a@b.c' } } as Parameters<typeof applySentryEventPolicy>[0],
      { originalException: new Error('Importing a module script failed.') },
    );

    expect(event.user).toEqual({ id: 7 });
    expect(event.tags?.recovered).toBe('true');
  });
});
