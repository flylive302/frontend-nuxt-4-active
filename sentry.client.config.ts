import * as Sentry from '@sentry/nuxt'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { applySentryEventPolicy } from '~/utils/sentry-event-policy'
import { resolveClientPlatform } from '~/utils/client-platform'
import { resolveTracePropagationTargets } from '~/utils/trace-targets'

const config = useRuntimeConfig()

// Both sync — they just read a bridge flag — so the platform tag can go
// straight into `initialScope` below with no delay to `Sentry.init`.
// `getPlatform()` rather than `isNativePlatform()` so that an iOS target,
// if one is ever added, is not silently tagged `android`.
const isNativeShell = Capacitor.isNativePlatform()
const capacitorPlatform = Capacitor.getPlatform()

Sentry.init({
  dsn: config.public.sentry.dsn as string,
  environment: config.public.sentry.environment as string,
  release: (config.public.sentry.release as string) || undefined,

  sendDefaultPii: false,

  // 🔴 Lowered 0.2 → 0.05 on 2026-08-07 (observability-audio-quality/18).
  // At 0.2 this project alone emitted ~122,000 spans/day against an org-wide
  // reserve of 5,000,000/month shared with the backend — the span reserve was
  // exhausted mid-period and every further span billed to the on-demand budget,
  // which then ran out and took ERROR ingestion down with it. Spans and errors
  // meter separately but draw on the same budget, so over-tracing is what
  // silently buys the blackout.
  //
  // ⚠️ This value is baked at build time (`ssr: false`), so changing it costs an
  // OTA — it is not a runtime dial. Raise it only against the current usage in
  // `GET /api/0/customers/flylive/` (`categories.spans.reserved` vs `.usage`),
  // never on feel.
  tracesSampleRate: 0.05,

  // observability-audio-quality/12: `tracesSampleRate` alone produced traces
  // that STOPPED AT THE BROWSER. `browserTracingIntegration` is auto-added by
  // @sentry/nuxt's client plugin, so sampling really was on — but Sentry's
  // default `tracePropagationTargets` is `['localhost', /^\//]`, which matches
  // relative URLs only. Our API is a different origin, so no outgoing API
  // request ever carried a trace header and browser→API tracing was inert.
  //
  // ⛔ Setting this REPLACES the default; the helper re-lists the defaults so
  // same-origin BFF routes keep propagating. Origin comes from runtime config,
  // never a literal — `apiBase` differs per environment.
  tracePropagationTargets: resolveTracePropagationTargets(
    config.public.apiBase as string | undefined,
  ),

  // Emit the W3C-standard `traceparent` header in addition to Sentry's own
  // `sentry-trace` / `baggage`. Defaults to false. Rides on the same
  // `tracePropagationTargets` matching above.
  //
  // 🔴 REQUIRES the backend to allow these three headers in `config/cors.php`
  // `allowed_headers` — that list is an explicit allowlist, not a wildcard, so
  // without it the CORS preflight fails and EVERY cross-origin API call breaks.
  // The backend allowance ships FIRST and is inert on its own; this is the flip.
  propagateTraceparent: true,

  // observability-audio-quality/07 (CE-03): attached here, not per-call-site,
  // so `platform` lands on EVERY event — not just the ones someone remembered
  // to instrument. `release` can't substitute (both builds mint a
  // format-identical commit hash), and this is the one dimension that was
  // completely absent.
  initialScope: {
    tags: { platform: resolveClientPlatform(capacitorPlatform) },
  },

  // Strips PII down to `user.id`, and tags auto-recovered stale-bundle errors
  // `recovered: true` so the issue stream can filter them with `!recovered:true`
  // without losing the evidence that chunk recovery still works.
  // Logic lives in `~/utils/sentry-event-policy` so it is unit-testable.
  beforeSend(event, hint) {
    return applySentryEventPolicy(event, hint)
  },
})

// The native shell's own version (Android `versionName`) is only knowable
// asynchronously (`App.getInfo()`), so it cannot join `initialScope` above
// without delaying `Sentry.init` on a native-bridge round trip. Setting it
// after init, on the resolved promise, is the accepted shape here — a
// handful of very-early events may land without it, which is a fair trade
// against blocking boot. Web builds skip this entirely: `App.getInfo()` has
// no meaningful version there.
if (isNativeShell) {
  App.getInfo()
    .then((info) => {
      Sentry.setTag('native_shell_version', info.version)
    })
    .catch(() => {
      // Never let a native-info read failure affect telemetry init.
    })
}
