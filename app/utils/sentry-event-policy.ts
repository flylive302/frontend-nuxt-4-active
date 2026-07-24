/**
 * Sentry `beforeSend` policy — pure, so it can be unit-tested.
 *
 * `sentry.client.config.ts` runs inside `Sentry.init()` and is not testable in
 * isolation, so the decision logic lives here instead. Mirrors the split already
 * used for `utils/stale-bundle-error.ts` and `utils/ota-gate.ts`.
 */

import { isStaleBundleError } from '~/utils/stale-bundle-error';

/** The subset of a Sentry event this policy reads or writes. */
export interface SentryEventLike {
  user?: { id?: string | number } | null;
  tags?: Record<string, string | number | boolean | undefined>;
  exception?: { values?: Array<{ value?: string }> };
}

/** The subset of Sentry's `EventHint` this policy reads. */
export interface SentryHintLike {
  originalException?: unknown;
}

/**
 * Applies both event policies in place and returns the event:
 *
 * 1. **PII scrub** — only `user.id` survives; everything else is dropped.
 * 2. **`recovered: true` tagging** — stale-bundle errors are recovered
 *    automatically by `plugins/chunk-reload.client.ts`, which reloads against
 *    the new manifest. They are still *reported*, and because the failing
 *    chunk's content-hashed filename is part of Sentry's fingerprint, every
 *    deploy mints a brand-new issue ID for the same already-handled fault.
 *
 * Tagging rather than dropping is deliberate. Discarding them would remove the
 * only evidence that the reload path still works — a recovery you cannot
 * observe is one you cannot trust. The tag lets the issue stream filter with
 * `!recovered:true` while the events remain queryable when the question is
 * "is chunk recovery still healthy?".
 */
export function applySentryEventPolicy<T extends SentryEventLike>(
  event: T,
  hint?: SentryHintLike,
): T {
  if (event.user) {
    event.user = { id: event.user.id };
  }

  // `originalException` is the real Error where the SDK has it; fall back to the
  // serialised exception message for events that arrive without one.
  const candidate = hint?.originalException ?? event.exception?.values?.[0]?.value;

  if (isStaleBundleError(candidate)) {
    event.tags = { ...event.tags, recovered: 'true' };
  }

  return event;
}
