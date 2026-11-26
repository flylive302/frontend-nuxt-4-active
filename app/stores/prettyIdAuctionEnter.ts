// ========================================
// Pretty ID Auction Entry Store — the "Pay entry" confirm dialog
// ========================================
// State + setters ONLY. The pipeline (gate, API call, toasts) lives in
// composables/pretty-id/usePrettyIdAuctionEnterActions. Not persisted.
// The viewer's standing itself is `prettyIdAuction.myStanding`.
// ========================================

import { defineStore } from 'pinia'

export const usePrettyIdAuctionEnterStore = defineStore('prettyIdAuctionEnter', () => {
  // ========================================
  // State
  // ========================================

  /** The auction whose entry dialog is open; `null` = closed. */
  const confirmId = ref<number | null>(null)
  /** The entry call is in flight: the dialog cannot be closed or confirmed again. */
  const isEntering = ref(false)
  /** The server said `insufficient_coins`: the dialog offers "Top up" instead of "Confirm". */
  const isShortOnCoins = ref(false)

  // ========================================
  // Setters
  // ========================================

  function setConfirmId(id: number | null): void {
    confirmId.value = id
  }

  function setEntering(value: boolean): void {
    isEntering.value = value
  }

  function setShortOnCoins(value: boolean): void {
    isShortOnCoins.value = value
  }

  function reset(): void {
    confirmId.value = null
    isEntering.value = false
    isShortOnCoins.value = false
  }

  return {
    confirmId: readonly(confirmId),
    isEntering: readonly(isEntering),
    isShortOnCoins: readonly(isShortOnCoins),
    setConfirmId,
    setEntering,
    setShortOnCoins,
    reset,
  }
})
