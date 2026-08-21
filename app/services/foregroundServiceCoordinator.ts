// ========================================
// Foreground Service Coordinator
// ========================================
//
// Impure executor for the pure `fgs-policy` (capacitor-03/04). Given the user's
// concurrent `RoomActivity`, it diffs the desired foreground-service set against
// the set currently running and starts/stops the delta through the native
// plugin bridge — `microphone` for producing, `mediaPlayback` for consuming, the
// union of both for a seated Speaker. All the DECISION lives in
// `utils/fgs-policy.ts`; this module only EXECUTES it — keeping the policy fully
// unit-testable.
//
// Module-level singleton: there is exactly one foreground-service reality per
// app process, so `running` is process state, not per-component state.
//
// Off Android the bridge is inert, so `apply()` is a harmless no-op and the
// caller can install its watch unconditionally.

import * as Sentry from '@sentry/nuxt'
import { createLogger } from '~/utils/logger'
import {
  fgsPolicy,
  diffFgs,
  type FgsService,
  type RoomActivity,
} from '~/utils/fgs-policy'
import {
  isForegroundServiceAvailable,
  startForegroundService,
  stopForegroundService,
  ensureNotificationPermission,
  onForegroundServiceFailure,
} from '~/services/foregroundService'

const log = createLogger('[FgsCoordinator]')

/** Longest normalised error label used in a Sentry fingerprint. */
const ERROR_LABEL_MAX_LENGTH = 80

/**
 * A stable, low-cardinality label for one failure mode, for fingerprinting.
 *
 * Android's refusal messages carry variable parts — uids, pids, Intent dumps,
 * package hashes — so the raw message would open a fresh Sentry issue per
 * device. Masking digits and hex and truncating collapses "the same refusal on
 * a thousand phones" to one issue while keeping "a DIFFERENT refusal" distinct,
 * which is the split that matters here.
 */
function normaliseErrorLabel(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .toLowerCase()
    .replace(/0x[0-9a-f]+/g, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ERROR_LABEL_MAX_LENGTH)
    || 'unknown'
}

/**
 * Report a start/stop failure to Sentry. Pure REACT-side effect: called after
 * the failure is already logged, never allowed to affect the caller.
 *
 * `captureException` (not `captureMessage`) — this is a genuine unexpected
 * exception from the native bridge and the real stack is the useful part, not
 * just a description. Tagged per op+service, and fingerprinted per
 * op+service+normalised-message, so a start failure and a stop failure for the
 * same service — or two DIFFERENT refusals of the same service — land as
 * separate Sentry issues instead of collapsing into one.
 *
 * Wrapped in try/catch: a throw from the Sentry SDK itself (e.g. not yet
 * initialized) must never escape into the caller's `apply()`.
 *
 * `error` crosses the Capacitor native bridge, so it is not guaranteed to be
 * a real `Error` (a rejected native call can surface as a plain object or
 * string) — `errorMessage` in `extra` keeps "why" readable even when
 * `captureException` falls back to its generic non-Error handling.
 */
function reportFgsFailure(op: 'start' | 'stop', service: FgsService, error: unknown): void {
  try {
    Sentry.captureException(error, {
      // op + service alone would cap this at four issues forever, so a brand-new
      // failure mode would land silently inside an existing issue and fire no
      // new-issue alert. This whole ticket exists because a failure class went
      // unnoticed for a month, so the normalised message joins the fingerprint:
      // a different reason for refusing the service becomes a different issue.
      fingerprint: ['fgs-service-failure', op, service, normaliseErrorLabel(error)],
      tags: { 'fgs.op': op, 'fgs.service': service },
      extra: {
        op,
        service,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    })
  } catch (reportErr) {
    log.warn('Failed to report foreground-service failure to Sentry', reportErr)
  }
}

/** The set of services believed to be running. Process-wide singleton state. */
let running = new Set<FgsService>()

/** Whether the native rejection listener has been attached this process. */
let nativeFailureListenerAttached = false

/**
 * Attach the native-side rejection listener once (mic-fgs-crash 04).
 *
 * A start that Android rejects INSIDE the service throws on a later dispatch,
 * outside `startForegroundService`'s promise — so `apply()`'s own catch below
 * never sees it. Before this epic that throw killed the process; now the native
 * service survives it and emits an event instead, and this routes that event
 * into the same Sentry reporting as a synchronous failure.
 *
 * Inert against a native shell that predates the emitter — the event simply
 * never arrives (spec D11: the two halves ship on different channels).
 */
function ensureNativeFailureListener(): void {
  if (nativeFailureListenerAttached) return
  nativeFailureListenerAttached = true
  void onForegroundServiceFailure(({ service, error }) => {
    log.warn(`Native rejected the ${service} foreground service`, error)
    // `running` is now a lie for this service: we believed it started and the
    // OS refused. Correct it so a later apply() retries rather than diffing
    // against a service that does not exist.
    //
    // Not an immediate retry, and deliberately so: apply() is driven by a watcher
    // on [isProducing, inRoom], which this delete does not re-fire. The retry
    // therefore rides the next genuine state flip. That is the bound — a
    // persistently refusing service is re-asked once per flip, never in a loop.
    running.delete(service)
    reportFgsFailure('start', service, new Error(error))
  })
}

/** Whether we've already requested POST_NOTIFICATIONS this process (request once). */
let notificationPermissionRequested = false

/**
 * Reconcile the running foreground services with the desired set for the given
 * activity. Idempotent: re-applying the same activity is a no-op.
 *
 * REACT-style — fire-and-forget from the caller's perspective; failures are
 * logged and reported to Sentry, never surfaced (thrown) to the caller.
 *
 * ⚠️ Corrected (mic-fgs-crash 02 / spec D10). This comment used to assert that
 * every service START happens in the foreground, because both flips that drive
 * it — entering a room (`consuming`) and taking a Seat (`producing`) — are
 * foreground, user-initiated actions. **That was false.** The seat-retention
 * re-claim in `useRoomAudio` flipped `producing` from a socket callback with no
 * user interaction at all. Backgrounded, that started a `microphone`-typed
 * service from the background, Android refused the while-in-use start, and the
 * uncaught SecurityException killed the process (Play crash cluster F6).
 *
 * What makes the claim true NOW is an explicit gate, not the shape of the call
 * sites: `decideSeatReclaim` defers that automatic re-claim while the app is
 * hidden, and the resume path settles it once we are back on screen. ⛔ The gate
 * lives on the re-produce, never here — suppressing the service while the mic
 * goes live is strictly worse than the crash (spec D1). Any FUTURE automatic
 * path that flips `producing` must carry its own visibility gate; this module
 * cannot supply one, and cannot detect one missing.
 *
 * A backgrounded demotion only ever STOPS `microphone` (the `mediaPlayback`
 * service stays up), never starting a service from the background
 * (capacitor-04 D1).
 */
export async function apply(activity: RoomActivity): Promise<void> {
  if (!isForegroundServiceAvailable()) return

  ensureNativeFailureListener()

  const desired = fgsPolicy(activity)
  const { start, stop } = diffFgs(running, desired)

  // Request the notification permission once, the first time we're about to
  // start a service — but NEVER gate the start on the answer (D3): a denied
  // notification still leaves the service running and keeping the mic alive.
  if (start.length > 0 && !notificationPermissionRequested) {
    notificationPermissionRequested = true
    try {
      const granted = await ensureNotificationPermission()
      if (!granted) {
        log.info('Notification permission denied; FGS will still run, notification suppressed.')
      }
    } catch (err) {
      log.warn('Notification permission request failed', err)
    }
  }

  for (const service of stop) {
    try {
      await stopForegroundService(service)
      running.delete(service)
    } catch (err) {
      log.warn(`Failed to stop ${service} foreground service`, err)
      reportFgsFailure('stop', service, err)
    }
  }

  for (const service of start) {
    try {
      await startForegroundService(service)
      running.add(service)
    } catch (err) {
      log.warn(`Failed to start ${service} foreground service`, err)
      reportFgsFailure('start', service, err)
    }
  }
}

/** Test-only: clear singleton state between cases. */
export function __resetForTest(): void {
  running = new Set<FgsService>()
  notificationPermissionRequested = false
  nativeFailureListenerAttached = false
}
