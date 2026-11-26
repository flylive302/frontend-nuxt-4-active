// ========================================
// Pretty ID Auction Bid Store — the bid field and the "Confirm bid" dialog
// ========================================
// State + setters ONLY. The pipeline (gate, API call, toasts) lives in
// composables/pretty-id/usePrettyIdAuctionBidActions. Not persisted.
// Whether the viewer leads is NOT stored: it is derived from the snapshot's
// leader id (see `isLeading` in the bid actions).
// ========================================

import { defineStore } from 'pinia'

export const usePrettyIdAuctionBidStore = defineStore('prettyIdAuctionBid', () => {
  // ========================================
  // State
  // ========================================

  /** What the bid field holds: digits only, `''` while empty. */
  const draft = ref('')
  /** The auction the draft belongs to; `null` = no draft yet. A different auction starts from its own minimum. */
  const draftAuctionId = ref<number | null>(null)
  /** The auction whose confirm dialog is open; `null` = closed. */
  const confirmId = ref<number | null>(null)
  /** The amount the dialog was opened with. The dialog shows and sends THIS, never the live field. */
  const confirmAmount = ref(0)
  /** The bid call is in flight: the dialog cannot be closed or confirmed again. */
  const isBidding = ref(false)
  /** The server said `insufficient_coins`: the dialog offers "Top up" instead of "Place bid". */
  const isShortOnCoins = ref(false)

  // ========================================
  // Setters
  // ========================================

  function setDraft(auctionId: number, value: string): void {
    draftAuctionId.value = auctionId
    draft.value = value
  }

  /** Opens the dialog for `id` with `amount`; `null` closes it and keeps the amount so a fading dialog does not blank. */
  function setConfirm(id: number | null, amount?: number): void {
    confirmId.value = id
    if (id !== null && amount !== undefined) confirmAmount.value = amount
  }

  function setBidding(value: boolean): void {
    isBidding.value = value
  }

  function setShortOnCoins(value: boolean): void {
    isShortOnCoins.value = value
  }

  function reset(): void {
    draft.value = ''
    draftAuctionId.value = null
    confirmId.value = null
    confirmAmount.value = 0
    isBidding.value = false
    isShortOnCoins.value = false
  }

  return {
    draft: readonly(draft),
    draftAuctionId: readonly(draftAuctionId),
    confirmId: readonly(confirmId),
    confirmAmount: readonly(confirmAmount),
    isBidding: readonly(isBidding),
    isShortOnCoins: readonly(isShortOnCoins),
    setDraft,
    setConfirm,
    setBidding,
    setShortOnCoins,
    reset,
  }
})
