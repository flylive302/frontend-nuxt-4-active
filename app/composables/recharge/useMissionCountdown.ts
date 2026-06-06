/**
 * Server-synced countdown to a mission instance reset.
 *
 * Takes `resetsAt` and `serverTime` from the progress API response.
 * Captures client/server clock skew once when serverTime first arrives so
 * the countdown stays accurate even if the device clock is wrong.
 *
 * Returns hours, minutes, seconds updated every second.
 * Cleans up the interval on unmount.
 */

import type { Ref } from 'vue'

// ========================================
// Types
// ========================================

interface UseMissionCountdownReturn {
  hours: Readonly<Ref<number>>
  minutes: Readonly<Ref<number>>
  seconds: Readonly<Ref<number>>
  isExpired: Readonly<Ref<boolean>>
}

// ========================================
// Composable
// ========================================

export function useMissionCountdown(
  resetsAt: Ref<string | null>,
  serverTime: Ref<string | null>,
): UseMissionCountdownReturn {
  const hours = ref(0)
  const minutes = ref(0)
  const seconds = ref(0)
  const isExpired = ref(false)

  // SSR guard — no interval on the server
  if (!import.meta.client) {
    return {
      hours: readonly(hours),
      minutes: readonly(minutes),
      seconds: readonly(seconds),
      isExpired: readonly(isExpired),
    }
  }

  // ========================================
  // Helpers
  // ========================================

  // Skew = (clientNow - serverNow) captured once when data arrives.
  // Recomputed on each new API response so a page refresh gets a fresh baseline.
  // Using this fixed skew: adjustedNow = Date.now() - capturedSkewMs advances
  // correctly with wall time, unlike recomputing from the static serverTime each tick.
  let capturedSkewMs: number | null = null

  function tick(): void {
    const resetsAtVal = resetsAt.value
    if (!resetsAtVal || capturedSkewMs === null) return

    const adjustedNow = Date.now() - capturedSkewMs
    const msLeft = new Date(resetsAtVal).getTime() - adjustedNow

    if (msLeft <= 0) {
      hours.value = 0
      minutes.value = 0
      seconds.value = 0
      isExpired.value = true
      return
    }

    const totalSecs = Math.floor(msLeft / 1000)
    hours.value = Math.floor(totalSecs / 3600)
    minutes.value = Math.floor((totalSecs % 3600) / 60)
    seconds.value = totalSecs % 60
  }

  // ========================================
  // Reactive skew capture
  // ========================================

  // Watch serverTime so we capture skew the moment data lands in the store
  // and trigger an immediate tick (no 1-second lag on first render).
  watch(serverTime, (newServerTime) => {
    if (newServerTime) {
      capturedSkewMs = Date.now() - new Date(newServerTime).getTime()
      tick()
    }
  }, { immediate: true })

  // ========================================
  // Lifecycle
  // ========================================

  let interval: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    interval = setInterval(tick, 1000)
  })

  onUnmounted(() => {
    if (interval !== null) {
      clearInterval(interval)
      interval = null
    }
  })

  return {
    hours: readonly(hours),
    minutes: readonly(minutes),
    seconds: readonly(seconds),
    isExpired: readonly(isExpired),
  }
}
