/**
 * Distributed-tracing propagation targets (observability-audio-quality/12).
 *
 * Sentry only attaches `sentry-trace` / `baggage` / `traceparent` to requests
 * whose URL matches `tracePropagationTargets`. Its default is
 * `['localhost', /^\//]` — relative URLs only, i.e. same-origin. Our API is on a
 * DIFFERENT origin, so by default no browser request to it carries a trace
 * header and browser→API tracing is silently inert.
 *
 * ⛔ Setting `tracePropagationTargets` REPLACES the default rather than
 * extending it, so the defaults are re-listed here on purpose. Dropping them
 * would kill propagation to the same-origin Nitro BFF routes (`/api/rooms`,
 * `/api/banners`, `/api/detect-country`).
 *
 * 🔴 The API origin is derived from runtime config, never hardcoded —
 * `apiBase` is env-driven per build (`nuxt.config.ts`), so a literal host would
 * be wrong in at least one environment.
 */

/** Sentry's own defaults — relative URLs and localhost. */
const SAME_ORIGIN_TARGETS: readonly (string | RegExp)[] = ['localhost', /^\//]

/**
 * Builds the propagation allow-list from the configured API base URL.
 *
 * Returns the same-origin defaults plus the API's origin. An absent or
 * unparseable `apiBase` yields the defaults alone — degrading to today's
 * behaviour rather than throwing during `Sentry.init`, which would take
 * error reporting down with it.
 *
 * @param apiBase - The configured API base URL, e.g. `https://api.example.com/api/v1`.
 * @returns Targets suitable for Sentry's `tracePropagationTargets`.
 */
export function resolveTracePropagationTargets(
  apiBase: string | undefined,
): (string | RegExp)[] {
  const targets = [...SAME_ORIGIN_TARGETS]

  if (!apiBase) {
    return targets
  }

  try {
    // `origin` deliberately drops the `/api/v1` path: Sentry matches against the
    // full outgoing URL, and the origin is the widest correct scope. Including
    // the path would miss calls to sibling paths on the same host (e.g. the
    // Sanctum CSRF endpoint on `apiRoot`).
    return [...targets, new URL(apiBase).origin]
  } catch {
    return targets
  }
}
