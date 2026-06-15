// ========================================
// Foreground Service Coordinator
// ========================================
//
// Impure executor for the pure `fgs-policy` (capacitor-03). Given the user's
// concurrent `RoomActivity`, it diffs the desired foreground-service set against
// the set currently running and starts/stops the delta through the native
// plugin bridge. All the DECISION lives in `utils/fgs-policy.ts`; this module
// only EXECUTES it — keeping the policy fully unit-testable.
//
// Module-level singleton: there is exactly one foreground-service reality per
// app process, so `running` is process state, not per-component state.
//
// Off Android the bridge is inert, so `apply()` is a harmless no-op and the
// caller can install its watch unconditionally.

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
} from '~/services/foregroundService'

const log = createLogger('[FgsCoordinator]')

/**
 * Services with a native handler THIS slice. `mediaPlayback` lands in
 * capacitor-04. A type guard (not a `Set.has`) so it narrows `FgsService` down
 * to the bridge's `'microphone'` parameter type.
 */
function isImplemented(service: FgsService): service is 'microphone' {
  return service === 'microphone'
}

/** The set of services believed to be running. Process-wide singleton state. */
let running = new Set<FgsService>()

/** Whether we've already requested POST_NOTIFICATIONS this process (request once). */
let notificationPermissionRequested = false

/**
 * Reconcile the running foreground services with the desired set for the given
 * activity. Idempotent: re-applying the same activity is a no-op.
 *
 * REACT-style — fire-and-forget from the caller's perspective; failures are
 * logged, never surfaced. The `producing` flip that drives this is always
 * caused by a foreground, user-initiated action (taking a Seat), so starting a
 * `microphone` FGS here satisfies the Android 14+ "no background start" rule.
 */
export async function apply(activity: RoomActivity): Promise<void> {
  if (!isForegroundServiceAvailable()) return

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
    if (!isImplemented(service)) {
      running.delete(service)
      continue
    }
    try {
      await stopForegroundService(service)
      running.delete(service)
    } catch (err) {
      log.warn(`Failed to stop ${service} foreground service`, err)
    }
  }

  for (const service of start) {
    if (!isImplemented(service)) {
      // No native handler yet (e.g. mediaPlayback → capacitor-04). Don't record
      // it as running, so it's retried once the handler exists.
      continue
    }
    try {
      await startForegroundService(service)
      running.add(service)
    } catch (err) {
      log.warn(`Failed to start ${service} foreground service`, err)
    }
  }
}

/** Test-only: clear singleton state between cases. */
export function __resetForTest(): void {
  running = new Set<FgsService>()
  notificationPermissionRequested = false
}
