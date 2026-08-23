// ========================================
// Level Actions Composable
// ========================================
// Role: Action/Orchestrator — handles realtime XP updates from socket events.
// Reads bootstrap config, updates auth store user XP.
// Pipeline: GATE → EXECUTE (callers handle UI feedback as REACT)

import type { UserLevelUpPayload } from '~/types/room/socket-events'
import { audioSocketRef } from '~/composables/room/useAudioSocket'
import { PROFILE_SYNC_THROTTLE_MS } from '~/constants/room'
import { createTrailingThrottle } from '~/utils/frame-batcher'

// ========================================
// Composable
// ========================================

/**
 * Orchestrates XP updates from socket events.
 * Updates auth store user XP so that all reactive consumers
 * (pages, components using computeLevelStatus) update automatically.
 *
 * Cross-store coordination belongs here per ARCHITECTURE.md:
 * "Stores never import or call methods on other stores —
 *  cross-store coordination belongs in composables."
 */
/** Throttled MSAB profile sync — module-level so every caller shares one window. */
const emitProfileSync = createTrailingThrottle<{ wealth_xp: string; charm_xp: string }>((profile) => {
  if (audioSocketRef.value?.connected) {
    audioSocketRef.value.emit('user:profileSync', { profile })
  }
}, PROFILE_SYNC_THROTTLE_MS)

export function useLevelActions() {
  const authStore = useAuthStore()
  const participantsStore = useRoomParticipantsStore()

  // ========================================
  // Public API
  // ========================================

  /**
   * Update wealth XP on the auth user.
   * Reactive consumers recompute level status automatically.
   */
  function updateWealthXp(currentXp: number): void {
    // GATE — require authenticated user
    if (!authStore.user) return

    // EXECUTE — update auth store XP
    authStore.user.wealth_xp = String(currentXp)
  }

  /**
   * Update charm XP on the auth user.
   * Reactive consumers recompute level status automatically.
   */
  function updateCharmXp(currentXp: number): void {
    // GATE — require authenticated user
    if (!authStore.user) return

    // EXECUTE — update auth store XP
    authStore.user.charm_xp = String(currentXp)
  }

  /**
   * Handle a realtime level.up socket event.
   * Routes the update by type (wealth/charm) and updates XP.
   * Called exclusively from progression.events.ts (events layer).
   */
  function handleLevelUp(payload: UserLevelUpPayload): void {
    const xp = parseFloat(payload.current_xp)
    if (payload.type === 'wealth') {
      updateWealthXp(xp)
    } else {
      updateCharmXp(xp)
    }
  }

  /**
   * Sync fresh XP from a balance.updated event into MSAB and the local
   * participants store. Called exclusively from economy.events.ts.
   *
   * EXECUTE: patches own participant entry (cross-domain write — authorised
   * because this is the composable EXECUTE stage, not a REACT event handler).
   * REACT: emits user:profileSync to MSAB so other room participants see it.
   */
  function syncXpFromBalance(wealthXp: string, charmXp: string): void {
    if (authStore.user) {
      participantsStore.updateParticipantProfile(authStore.user.id, {
        wealth_xp: wealthXp,
        charm_xp: charmXp,
      })
    }

    emitProfileSync({ wealth_xp: wealthXp, charm_xp: charmXp })
  }

  return {
    updateWealthXp,
    updateCharmXp,
    handleLevelUp,
    syncXpFromBalance,
  }
}
