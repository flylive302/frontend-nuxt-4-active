import { defineStore } from 'pinia'
import type { CenterCashbackState, FloatingMultiplier, LuckySenderBand } from '~/types/lucky'

export const useLuckySessionStore = defineStore('luckySessionStore', () => {
  // ========================================
  // State
  // ========================================

  /** Text notice floaters (no-draw hints). Win SVGAs use centerCashback now. */
  const floatingMultipliers = ref<FloatingMultiplier[]>([])

  /** The single center cashback visual — overwritten, never queued */
  const centerCashback = ref<CenterCashbackState | null>(null)

  /** One band per active sender, keyed by senderId */
  const senderBands = ref(new Map<number, LuckySenderBand>())

  // ========================================
  // Computed
  // ========================================

  /** Bands that currently hold a visible slot, for rendering */
  const visibleBands = computed<LuckySenderBand[]>(() =>
    [...senderBands.value.values()].filter((b) => b.slot !== null),
  )

  // ========================================
  // Setters — floaters
  // ========================================

  function addFloater(entry: FloatingMultiplier): void {
    floatingMultipliers.value.push(entry)
  }

  function removeFloater(id: number): void {
    floatingMultipliers.value = floatingMultipliers.value.filter((f) => f.id !== id)
  }

  // ========================================
  // Setters — center cashback
  // ========================================

  function setCenterCashback(state: CenterCashbackState | null): void {
    centerCashback.value = state
  }

  function setCenterCashbackPhase(phase: CenterCashbackState['phase']): void {
    if (centerCashback.value) centerCashback.value.phase = phase
  }

  // ========================================
  // Setters — sender bands
  // ========================================

  function upsertBand(band: LuckySenderBand): void {
    senderBands.value.set(band.senderId, band)
  }

  function patchBand(senderId: number, patch: Partial<LuckySenderBand>): void {
    const band = senderBands.value.get(senderId)
    if (band) Object.assign(band, patch)
  }

  function removeBand(senderId: number): void {
    senderBands.value.delete(senderId)
  }

  // ========================================
  // Reset
  // ========================================

  function $reset(): void {
    floatingMultipliers.value = []
    centerCashback.value = null
    senderBands.value.clear()
  }

  // ========================================
  // Return
  // ========================================

  return {
    floatingMultipliers,
    centerCashback,
    senderBands,
    visibleBands,
    addFloater,
    removeFloater,
    setCenterCashback,
    setCenterCashbackPhase,
    upsertBand,
    patchBand,
    removeBand,
    $reset,
  }
})
