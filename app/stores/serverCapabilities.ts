// ========================================
// Server Capabilities Store
// ========================================
//
// Mirrors the `server:capabilities` socket event (gift-authority-tick-fanout
// ticket 13). MSAB re-emits this on every (re)connect, so the store always
// reflects the CURRENT socket session — never a stale one from before a
// reconnect. Absent/false capability must make every consumer fall back to
// legacy behaviour, byte-identical to today.
//
// `giftBatch` is consumed by ticket 15's fan-out work; keep these names
// stable — another agent wires into this exact store.

import { defineStore } from 'pinia'

export const useServerCapabilitiesStore = defineStore('serverCapabilities', () => {
  // ========================================
  // State
  // ========================================

  const giftBatch = ref(false)
  const ackBalance = ref(false)

  // ========================================
  // Setters
  // ========================================

  /** Apply a `server:capabilities` payload. Missing keys default to false (safe/legacy). */
  function setCapabilities(payload: { giftBatch?: boolean; ackBalance?: boolean }): void {
    giftBatch.value = payload.giftBatch ?? false
    ackBalance.value = payload.ackBalance ?? false
  }

  /** Back to legacy defaults — call on socket disconnect. */
  function reset(): void {
    giftBatch.value = false
    ackBalance.value = false
  }

  // ========================================
  // Return
  // ========================================

  return {
    giftBatch,
    ackBalance,
    setCapabilities,
    reset,
  }
})
