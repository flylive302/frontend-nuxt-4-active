// ========================================
// Malformed list-payload reporter
// ========================================
//
// Diagnostic instrumentation for JAVASCRIPT-VUE-74: a list endpoint returned
// something whose `data` was not an array, which used to leave a store's
// `items` undefined and crash a render-time computed.
//
// The crash itself is now guarded at the write sites. What is still unknown is
// WHERE the bad payload came from — the failing response was never captured
// (the trace was unsampled and no breadcrumbs were retained). The leading
// hypothesis is a non-JSON 200: Cloudflare Pages serves the SPA shell as
// `200 text/html` for unmatched paths, and ofetch parses `text/html` as text,
// so `response` would be a string and `response.data` undefined — silently.
//
// A body snippet discriminates that instantly: an HTML shell starts `<!DOCTYPE`.
// We only see the parsed body here (the `api()` wrapper does not surface
// headers), so the snippet stands in for the content-type.
//
// Deduped per endpoint per page-load — this fires on a render path and must
// never become an event-quota problem.
// ========================================

import * as Sentry from '@sentry/nuxt'

const SNIPPET_LENGTH = 200

const reported = new Set<string>()

/** Shape summary of an unexpected payload, safe to send to Sentry. */
function describe(payload: unknown): Record<string, unknown> {
  if (typeof payload === 'string') {
    return {
      payloadType: 'string',
      length: payload.length,
      // The decisive field: `<!DOCTYPE html…` proves the SPA-shell hypothesis.
      snippet: payload.slice(0, SNIPPET_LENGTH),
    }
  }

  if (payload && typeof payload === 'object') {
    const keys = Object.keys(payload as Record<string, unknown>)
    return {
      payloadType: Array.isArray(payload) ? 'array' : 'object',
      keys: keys.slice(0, 20),
      dataType: typeof (payload as Record<string, unknown>).data,
    }
  }

  return { payloadType: payload === null ? 'null' : typeof payload }
}

/**
 * Report a list endpoint whose `data` was not an array.
 * No-ops on repeat calls for the same endpoint within a page load.
 */
export function reportMalformedPayload(endpoint: string, payload: unknown): void {
  if (reported.has(endpoint)) return
  reported.add(endpoint)

  Sentry.captureMessage(`Malformed list payload: ${endpoint}`, {
    level: 'warning',
    tags: { source: 'malformed-list-payload', endpoint },
    extra: { endpoint, ...describe(payload) },
  })
}

/** Test seam — clears the per-page-load dedupe set. */
export function resetMalformedPayloadReports(): void {
  reported.clear()
}
