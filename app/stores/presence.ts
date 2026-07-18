// ========================================
// Presence Store (dm-realtime-platform/07)
// ========================================
// Ephemeral online/offline state for contacts currently visible in the
// open inbox list or open thread. NOT a persistent/global presence store —
// scoped strictly to what's actively subscribed (ADR 0021 rejects global
// fan-out). State only: no API calls, no socket code here.

import { defineStore } from 'pinia'

export const usePresenceStore = defineStore('presence', () => {
  // ── State ─────────────────────────────────────────────
  const onlineByUserId = ref<Record<number, boolean>>({})
  const subscribedUserIds = ref<Set<number>>(new Set())

  // ── Setters ───────────────────────────────────────────
  function setOnline(userId: number, online: boolean): void {
    onlineByUserId.value = { ...onlineByUserId.value, [userId]: online }
  }

  function applySnapshot(snapshot: Record<number, boolean>): void {
    onlineByUserId.value = { ...onlineByUserId.value, ...snapshot }
  }

  function setSubscriptions(ids: number[]): void {
    subscribedUserIds.value = new Set(ids)
  }

  function $reset(): void {
    onlineByUserId.value = {}
    subscribedUserIds.value = new Set()
  }

  return {
    onlineByUserId,
    subscribedUserIds,
    setOnline,
    applySnapshot,
    setSubscriptions,
    $reset,
  }
})
