/**
 * Finale state-machine for the Recharge Activity ranking cinematic.
 *
 * Drives the full-screen overlay through four phases:
 *   idle → warning → burst → reveal | dismissed (at any point)
 *
 * Pure store consumer — adds no echo subscriptions.
 * The store is populated by useRechargeLeaderboard (already running in the tab).
 *
 * Once-per-instance: an in-session Set plus localStorage prevent replay.
 * Tick-based detection (1 s) avoids reactive watch complexity in tests.
 */

import { createLogger } from '~/utils/logger'

const log = createLogger('[MissionFinale]')

export type FinalePhase = 'idle' | 'warning' | 'burst' | 'reveal' | 'dismissed'

// ========================================
// Module-level state (once-per-instance guards)
// ========================================

const _firedThisSession = new Set<string>()

function storageKey(timeframe: string, instanceKey: string): string {
  return `mf_seen_${timeframe}_${instanceKey}`
}

function isInstanceDismissed(timeframe: string, instanceKey: string): boolean {
  try {
    return localStorage.getItem(storageKey(timeframe, instanceKey)) === '1'
  } catch {
    return false
  }
}

function persistDismiss(timeframe: string, instanceKey: string): void {
  _firedThisSession.delete(instanceKey)
  try {
    localStorage.setItem(storageKey(timeframe, instanceKey), '1')
  } catch { /* ignore */ }
}

// ========================================
// Composable
// ========================================

export function useMissionFinale(timeframe: 'weekly' | 'monthly') {
  const store = useMissionStore()

  const phase = ref<FinalePhase>('idle')

  // ========================================
  // Helpers
  // ========================================

  function resolveInstanceKey(): string | null {
    return (
      store.leaderboardFor(timeframe)?.instance_key ??
      store.finaleSnapshotFor(timeframe)?.instance_key ??
      null
    )
  }

  function isUserInTopN(): boolean {
    const self = store.leaderboardFor(timeframe)?.self
    const depth = store.progressFor(timeframe)?.config?.ranking_depth
    if (!self || !depth) return false
    return self.rank <= depth
  }

  function goToReveal(key: string | null): void {
    if (key) _firedThisSession.add(key)
    phase.value = 'reveal'
    log.debug('Finale reveal', { timeframe, instanceKey: key })
  }

  // ========================================
  // Tick (checked every 1 s via setInterval)
  // ========================================

  function tick(): void {
    if (phase.value === 'burst' || phase.value === 'reveal' || phase.value === 'dismissed') return

    const isReady = store.isFinaleReadyFor(timeframe)

    // warning → burst when finale is server-finalized
    if (phase.value === 'warning') {
      if (isReady) {
        phase.value = 'burst'
        log.debug('Finale burst triggered', { timeframe })
      }
      return
    }

    // idle: check if already finalized (user arrived post-T0)
    if (isReady) {
      const snap = store.finaleSnapshotFor(timeframe)
      const key = snap?.instance_key ?? null
      if (key && isInstanceDismissed(timeframe, key)) {
        phase.value = 'dismissed'
      } else {
        goToReveal(key)
      }
      return
    }

    // idle → warning: within finale_warning_seconds and self is in Top-N
    const lb = store.leaderboardFor(timeframe)
    const cfg = store.progressFor(timeframe)?.config
    if (!lb?.resets_at || !cfg?.finale_warning_seconds) return

    const msUntilReset = new Date(lb.resets_at).getTime() - Date.now()
    if (msUntilReset <= 0 || msUntilReset >= cfg.finale_warning_seconds * 1000) return

    if (!isUserInTopN()) return

    const key = resolveInstanceKey()
    if (!key) return

    // Already fired in this session (overlay is/was open in another instance of the composable)
    if (_firedThisSession.has(key)) return

    // Previously dismissed: reflect that state rather than leaving idle
    if (isInstanceDismissed(timeframe, key)) {
      phase.value = 'dismissed'
      return
    }

    _firedThisSession.add(key)
    phase.value = 'warning'
    log.debug('Finale warning triggered', { timeframe, instanceKey: key, msUntilReset })
  }

  // ========================================
  // Public API
  // ========================================

  function burstComplete(): void {
    if (phase.value === 'burst') {
      phase.value = 'reveal'
      log.debug('Burst complete → reveal', { timeframe })
    }
  }

  function dismiss(): void {
    const key = resolveInstanceKey()
    if (key) persistDismiss(timeframe, key)
    phase.value = 'dismissed'
    log.debug('Finale dismissed', { timeframe })
  }

  // ========================================
  // Lifecycle
  // ========================================

  let intervalId: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    tick()
    intervalId = setInterval(tick, 1_000)
  })

  onUnmounted(() => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  })

  return {
    phase: readonly(phase),
    isOpen: computed(() => phase.value === 'warning' || phase.value === 'burst' || phase.value === 'reveal'),
    dismiss,
    burstComplete,
  }
}
