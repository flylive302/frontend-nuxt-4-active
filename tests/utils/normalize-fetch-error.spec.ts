import { describe, it, expect } from 'vitest';
import { normalizeFetchError } from '~/utils/api/normalizeFetchError';

/** Build the `$fetch` error shape ofetch throws, so tests exercise the real parse path. */
function fetchError(status: number, data: unknown): unknown {
  return { response: { status, _data: data } };
}

describe('normalizeFetchError', () => {
  describe('422 with a non-array `errors` value (Sentry JAVASCRIPT-VUE-5B)', () => {
    // `ApiResponse::error()` sends `errors: {error_code: '...'}` — a plain string, not
    // Laravel's `string[]`. The old cast trusted the declared type and called
    // `.find()` on the string, so every mistyped OTP crashed the submit instead of
    // showing "Invalid or expired verification code."
    const payload = fetchError(422, {
      message: 'Invalid or expired verification code.',
      errors: { error_code: 'INVALID_VERIFICATION_CODE' },
    });

    it('does not throw', () => {
      expect(() => normalizeFetchError(payload)).not.toThrow();
    });

    it('surfaces the backend message rather than a humanized key name', () => {
      expect(normalizeFetchError(payload).message).toBe('Invalid or expired verification code.');
    });

    it('does not expose the string value as a field error', () => {
      // `error_code` names no form field; leaking it would make `setErrors` target
      // an input that does not exist.
      expect(normalizeFetchError(payload).fieldErrors).toBeUndefined();
    });
  });

  describe('genuine Laravel validation errors still work', () => {
    // Regression guard: a filter aggressive enough to drop the string above must not
    // also drop real field errors, or every validation message disappears.
    const payload = fetchError(422, {
      message: 'Validation failed',
      errors: { code: ['Enter the 6-digit code'], email: ['The email field is required.'] },
    });

    it('keeps every field error', () => {
      expect(normalizeFetchError(payload).fieldErrors).toEqual({
        code: ['Enter the 6-digit code'],
        email: ['The email field is required.'],
      });
    });

    it('uses the first usable message as the general message', () => {
      expect(normalizeFetchError(payload).message).toBe('Enter the 6-digit code');
    });
  });

  describe('mixed shapes', () => {
    it('keeps the array entries and drops the rest', () => {
      const result = normalizeFetchError(
        fetchError(422, {
          message: 'Validation failed',
          errors: { error_code: 'SOME_CODE', code: ['Enter the 6-digit code'] },
        }),
      );

      expect(result.fieldErrors).toEqual({ code: ['Enter the 6-digit code'] });
      expect(result.message).toBe('Enter the 6-digit code');
    });
  });

  describe('totality — never throws on hostile input', () => {
    it.each([
      ['a number value', { error_code: 42 }],
      ['a null value', { field: null }],
      ['a nested object', { field: { nested: true } }],
      ['an array of non-strings', { field: [1, 2, 3] }],
      ['errors as a string', 'boom'],
      ['errors as an array', ['boom']],
      ['errors as null', null],
    ])('survives %s', (_label, errors) => {
      const run = () => normalizeFetchError(fetchError(422, { message: 'Nope', errors }));

      expect(run).not.toThrow();
      expect(run().message).toBe('Nope');
    });
  });

  describe('unchanged behaviour outside the 422 branch', () => {
    it('reads errorCode from a non-422 response', () => {
      const result = normalizeFetchError(
        fetchError(403, { message: 'Verify your email.', errors: { error_code: 'EMAIL_NOT_VERIFIED' } }),
      );

      expect(result.status).toBe(403);
      expect(result.errorCode).toBe('EMAIL_NOT_VERIFIED');
      expect(result.message).toBe('Verify your email.');
    });

    it('reports a network error when there is no status', () => {
      expect(normalizeFetchError(new Error('offline')).message).toBe(
        'Network error. Check your connection.',
      );
    });

    it('reports a cancelled request for AbortError', () => {
      const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });

      expect(normalizeFetchError(abort).message).toBe('Request was cancelled.');
    });
  });
});
