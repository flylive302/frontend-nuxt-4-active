// ========================================
// Connectivity Store (frontend-offline-resilience/01 — ADR 0026)
// ========================================
// State only: no probing, no listeners, no API calls. The pipeline that decides
// WHEN to flip these lives in `useConnectivityMonitor`.
//
// Background: `app/services/networkDetector.ts` fired `online`/`offline` into a
// callback set with zero subscribers, and `app/pages/offline.vue` was never
// navigated to. Both halves of the feature existed; nothing joined them. The
// banner this store drives is that join — a NON-BLOCKING indicator, because a
// full-screen takeover would eject a user from a live audio room on a
// four-second signal drop (ADR 0026).

import { defineStore } from 'pinia'

/**
 * Consecutive network-level API failures required before the banner appears.
 * One flaky request must not flip the app into an offline state; a genuinely
 * dead network fails every request, so two arrives almost immediately.
 */
export const OFFLINE_FAILURE_THRESHOLD = 2

export const useConnectivityStore = defineStore('connectivity', () => {
  // ── State ─────────────────────────────────────────────

  /** True while the app believes it cannot reach the API. Drives the banner. */
  const isOffline = ref(false)

  /** True while a `probeHealth()` call is in flight (banner shows a spinner). */
  const isProbing = ref(false)

  /**
   * Bumped every time connectivity is RESTORED. Screens watch this to refetch
   * data that failed while offline.
   *
   * ⛔ Never add a watcher-free "signal" here. A restored-signal with no
   * subscriber is exactly the bug ADR 0026 exists to undo.
   */
  const restoredAt = ref(0)

  /**
   * Consecutive network-level API failures. Reset by any success, and by
   * entering the offline state (where the backoff poll takes over).
   */
  const consecutiveFailures = ref(0)

  // ── Computed ──────────────────────────────────────────

  /** True once enough consecutive failures have accumulated to declare offline. */
  const failureThresholdReached = computed(
    () => consecutiveFailures.value >= OFFLINE_FAILURE_THRESHOLD,
  )

  // ── Setters ───────────────────────────────────────────

  function goOffline(): void {
    if (isOffline.value) return
    isOffline.value = true
    consecutiveFailures.value = 0
  }

  function goOnline(): void {
    if (!isOffline.value) return
    isOffline.value = false
    isProbing.value = false
    consecutiveFailures.value = 0
    restoredAt.value = Date.now()
  }

  function setProbing(probing: boolean): void {
    isProbing.value = probing
  }

  /**
   * Record one network-level API failure (no response at all).
   *
   * ⛔ An HTTP error response is NOT a network failure — the network delivered
   * it. Only report transport-level failures here.
   */
  function recordFailure(): void {
    // Already offline: the backoff poll owns recovery, so counting further
    // failures would only churn the threshold computed.
    if (isOffline.value) return
    consecutiveFailures.value += 1
  }

  function resetFailures(): void {
    consecutiveFailures.value = 0
  }

  function $reset(): void {
    isOffline.value = false
    isProbing.value = false
    restoredAt.value = 0
    consecutiveFailures.value = 0
  }

  return {
    isOffline,
    isProbing,
    restoredAt,
    consecutiveFailures,
    failureThresholdReached,
    goOffline,
    goOnline,
    setProbing,
    recordFailure,
    resetFailures,
    $reset,
  }
})
