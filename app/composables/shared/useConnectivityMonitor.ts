// ========================================
// Connectivity Monitor (frontend-offline-resilience/01 — ADR 0026)
// ========================================
// Role: Action/Orchestrator — owns the offline-state pipeline.
// Pipeline: GATE (should we flip?) → EXECUTE (flip + probe) → REACT (poll).
//
// ⚠️ The asymmetry here is deliberate and is the whole point of the design:
//
//   ENTER on `navigator.onLine` / the `offline` event — it is instant and free.
//   EXIT  on `probeHealth()` ONLY — never on `navigator.onLine`.
//
// `navigator.onLine` reports LINK status, not REACHABILITY. It is `true` on a
// captive portal and on wifi with no upstream, which are precisely the cases
// that rendered as "No results yet." on a dead network. Trusting it to exit
// would clear the banner while the API is still unreachable.

import { onConnectionChange } from '~/services/networkDetector'
import { createLogger } from '~/utils/logger'

const log = createLogger('[Connectivity]')

// ========================================
// Constants
// ========================================

/**
 * Backoff schedule for the recovery probe, in ms; the last value repeats.
 *
 * A captive portal never fires an `online` event, so polling is the only way
 * out of the banner without user action. At the 30s floor this costs 2 req/min
 * against the 60/min `api_dynamic` budget.
 */
const PROBE_BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000] as const

// ========================================
// Composable
// ========================================

export function useConnectivityMonitor() {
  const store = useConnectivityStore()
  const { probeHealth } = useConnectivityProbe()

  let timer: ReturnType<typeof setTimeout> | null = null
  let backoffIndex = 0
  let stopListening: (() => void) | null = null

  // ========================================
  // Helpers
  // ========================================

  function clearTimer(): void {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function nextDelay(): number {
    const delay = PROBE_BACKOFF_MS[Math.min(backoffIndex, PROBE_BACKOFF_MS.length - 1)]
    backoffIndex += 1
    return delay ?? 30_000
  }

  // ========================================
  // EXECUTE
  // ========================================

  /**
   * Enter the offline state. Idempotent — safe to call from both entry paths.
   */
  function enterOffline(reason: 'event' | 'api-failure'): void {
    // GATE — already offline: the poll is running, nothing to do.
    if (store.isOffline) return

    log.warn(`Entering offline state (${reason})`)
    store.goOffline()
    backoffIndex = 0
    scheduleProbe()
  }

  /**
   * Ask the API whether it is actually reachable, and leave the offline state
   * only if it answers.
   *
   * @returns True when connectivity was restored by this attempt.
   */
  async function attemptRecovery(): Promise<boolean> {
    // GATE — nothing to recover, or a probe is already in flight.
    if (!store.isOffline || store.isProbing) return false

    store.setProbing(true)
    const reachable = await probeHealth()
    store.setProbing(false)

    if (!reachable) {
      scheduleProbe()
      return false
    }

    log.info('Connectivity restored')
    clearTimer()
    // REACT — bumps `restoredAt`, which screens watch to refetch what failed.
    store.goOnline()
    return true
  }

  /** Queue the next recovery probe on the backoff schedule. */
  function scheduleProbe(): void {
    clearTimer()
    if (!store.isOffline) return

    timer = setTimeout(() => {
      void attemptRecovery()
    }, nextDelay())
  }

  /**
   * User-initiated retry (tapping the banner): probe now and reset the backoff
   * so a second tap is not punished by the schedule.
   */
  async function retryNow(): Promise<boolean> {
    backoffIndex = 0
    clearTimer()
    return attemptRecovery()
  }

  // ========================================
  // INTENT
  // ========================================

  /**
   * Subscribe to the network detector and take the initial reading.
   *
   * Until this ran, `onConnectionChange` had zero subscribers — the detector
   * fired into nothing for the life of the app.
   *
   * @returns Teardown for the listener + any pending probe.
   */
  function start(): () => void {
    if (import.meta.server) return () => {}

    // The SECOND entry path. The shared fetch client (`useApi`) reports
    // network-level failures straight to the store — it must not import this
    // composable, which would close a cycle through `useConnectivityProbe`.
    // Watching the threshold here keeps the decision in the pipeline layer.
    const stopWatching = watch(
      () => store.failureThresholdReached,
      (reached) => {
        if (reached) enterOffline('api-failure')
      },
    )

    stopListening = onConnectionChange((info) => {
      if (!info.isOnline) {
        enterOffline('event')
        return
      }
      // The link came back. That is a REASON to probe, never a reason to
      // declare the app online — see the note at the top of this file.
      void retryNow()
    })

    // Initial reading: the app may have started while already offline.
    //
    // ⚠️ Compared against `false` explicitly, never truthiness. `navigator`
    // exists in environments that do not implement `onLine` (Node ≥18 defines a
    // global `navigator` with no such property), where `!navigator.onLine`
    // is true and would declare a perfectly healthy session offline.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) enterOffline('event')

    return () => {
      stopWatching()
      stopListening?.()
      stopListening = null
      clearTimer()
    }
  }

  return {
    start,
    retryNow,
    enterOffline,
  }
}
