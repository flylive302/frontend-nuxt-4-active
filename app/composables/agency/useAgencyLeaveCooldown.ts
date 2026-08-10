/**
 * Server-driven countdown to `cooldown_ends_at` on the leave-request cooldown.
 *
 * Unlike `useMissionCountdown`, the membership payload does not carry a
 * separate `server_time` field to correct for client/server clock skew —
 * the ticket explicitly scopes this to "no client-side clock math beyond
 * countdown display," so this diffs straight against `Date.now()`. The
 * value driving whether the button is disabled is always the server field
 * (`can_request_leave` / `leave_request_status`); this composable only
 * renders the remaining time and flags expiry so the caller can refetch.
 */

import type { Ref } from 'vue'

// ========================================
// Types
// ========================================

interface UseAgencyLeaveCooldownReturn {
  hours: Readonly<Ref<number>>
  minutes: Readonly<Ref<number>>
  seconds: Readonly<Ref<number>>
  isExpired: Readonly<Ref<boolean>>
}

// ========================================
// Composable
// ========================================

export function useAgencyLeaveCooldown(cooldownEndsAt: Ref<string | null | undefined>): UseAgencyLeaveCooldownReturn {
  const hours = ref(0)
  const minutes = ref(0)
  const seconds = ref(0)
  const isExpired = ref(false)

  // SSR guard — no interval on the server (app is a pure SPA, but keep the
  // guard consistent with the established countdown pattern).
  if (!import.meta.client) {
    return {
      hours: readonly(hours),
      minutes: readonly(minutes),
      seconds: readonly(seconds),
      isExpired: readonly(isExpired),
    }
  }

  function tick(): void {
    const endsAt = cooldownEndsAt.value

    if (!endsAt) {
      hours.value = 0
      minutes.value = 0
      seconds.value = 0
      isExpired.value = false
      return
    }

    const msLeft = new Date(endsAt).getTime() - Date.now()

    if (msLeft <= 0) {
      hours.value = 0
      minutes.value = 0
      seconds.value = 0
      isExpired.value = true
      return
    }

    isExpired.value = false
    const totalSecs = Math.floor(msLeft / 1000)
    hours.value = Math.floor(totalSecs / 3600)
    minutes.value = Math.floor((totalSecs % 3600) / 60)
    seconds.value = totalSecs % 60
  }

  watch(cooldownEndsAt, tick, { immediate: true })

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
