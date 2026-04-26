// ========================================
// Level Actions Composable
// ========================================
// Role: Action/Orchestrator — handles realtime XP updates from socket events.
// Reads bootstrap config, updates auth store user XP.
// Pipeline: GATE → EXECUTE (callers handle UI feedback as REACT)

import type { UserLevelUpPayload } from '~/types/room/socket-events'

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
export function useLevelActions() {
  const authStore = useAuthStore()

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

  return {
    updateWealthXp,
    updateCharmXp,
    handleLevelUp,
  }
}
