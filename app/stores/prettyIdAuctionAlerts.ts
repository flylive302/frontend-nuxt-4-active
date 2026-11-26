// ========================================
// Pretty ID Auction Alerts Store — the "Auction alerts" mute toggle
// ========================================
// State + setters ONLY. The API calls, toasts and rollback live in
// composables/pretty-id/usePrettyIdAuctionAlerts. Not persisted: the server
// is the source of truth and the toggle refetches when the tab opens.
// ========================================

import { defineStore } from 'pinia'

export const usePrettyIdAuctionAlertsStore = defineStore('prettyIdAuctionAlerts', () => {
  // ========================================
  // State
  // ========================================

  /** Global auction pushes are on. The server default (no mute row) is on. */
  const enabled = ref(true)
  /** The server has told us the real value at least once. */
  const isLoaded = ref(false)
  /** A change is in flight; further taps are ignored until it lands. */
  const isSaving = ref(false)

  // ========================================
  // Setters
  // ========================================

  function setEnabled(value: boolean): void {
    enabled.value = value
  }

  /** The server's answer: also marks the toggle as loaded. */
  function setServerEnabled(value: boolean): void {
    enabled.value = value
    isLoaded.value = true
  }

  function setSaving(value: boolean): void {
    isSaving.value = value
  }

  function reset(): void {
    enabled.value = true
    isLoaded.value = false
    isSaving.value = false
  }

  return {
    enabled: readonly(enabled),
    isLoaded: readonly(isLoaded),
    isSaving: readonly(isSaving),
    setEnabled,
    setServerEnabled,
    setSaving,
    reset,
  }
})
