/**
 * Sentry integration policy for the browser/native-shell client.
 *
 * android-client-performance/17: Sentry's `BrowserApiErrors` integration wraps
 * EVERY `setTimeout`, `requestAnimationFrame`, `addEventListener` callback and
 * XHR handler in a try/catch trampoline. On the Oppo A6x that trampoline alone
 * showed 1.6–1.9 s of self-time per 41 s in a live room (~4–5 % of the main
 * thread, ~8,000 wrapped calls) — and because every callback then appears as
 * the same wrapper frame, device traces lose the real callback names.
 *
 * Dropping it costs nothing we rely on: uncaught errors in those callbacks
 * still reach `window.onerror` / `onunhandledrejection` (the `GlobalHandlers`
 * integration), with their stack. Only the `mechanism` tag changes from
 * `instrument` to `onerror`.
 *
 * Pure, so the policy is unit-testable without `Sentry.init`.
 */

/** Minimal shape of a Sentry integration we need to filter on. */
export interface IntegrationLike {
  name: string
}

/** Integrations that wrap hot main-thread callbacks and are dropped. */
export const DROPPED_SENTRY_INTEGRATIONS: ReadonlySet<string> = new Set(['BrowserApiErrors'])

export function dropMainThreadWrapperIntegrations<T extends IntegrationLike>(
  integrations: readonly T[],
): T[] {
  return integrations.filter(integration => !DROPPED_SENTRY_INTEGRATIONS.has(integration.name))
}
