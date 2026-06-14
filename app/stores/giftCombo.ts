import { defineStore } from 'pinia';
import type { GiftComboContext } from '~/types/gift/gift';

export const useGiftComboStore = defineStore('giftComboStore', () => {
  // ========================================
  // State
  // ========================================

  const pendingRefund = ref(0);
  const lastLuckyContext = ref<GiftComboContext | null>(null);
  const isLuckyComboActive = ref(false);
  /**
   * Snapshot of the last normal (non-lucky) send, so a combo press repeats THAT
   * gift rather than whatever the playback queue happens to show now.
   */
  const lastNormalContext = ref<GiftComboContext | null>(null);

  // ========================================
  // Setters
  // ========================================

  function setPendingRefund(amount: number): void {
    pendingRefund.value = amount;
  }

  function setLuckyContext(ctx: GiftComboContext): void {
    lastLuckyContext.value = ctx;
    isLuckyComboActive.value = true;
  }

  function clearLuckyContext(): void {
    lastLuckyContext.value = null;
    isLuckyComboActive.value = false;
  }

  function setNormalContext(ctx: GiftComboContext): void {
    lastNormalContext.value = ctx;
  }

  function clearNormalContext(): void {
    lastNormalContext.value = null;
  }

  // ========================================
  // Reset
  // ========================================

  function $reset(): void {
    pendingRefund.value = 0;
    lastLuckyContext.value = null;
    isLuckyComboActive.value = false;
    lastNormalContext.value = null;
  }

  // ========================================
  // Return
  // ========================================

  return {
    pendingRefund,
    lastLuckyContext,
    isLuckyComboActive,
    lastNormalContext,
    setPendingRefund,
    setLuckyContext,
    clearLuckyContext,
    setNormalContext,
    clearNormalContext,
    $reset,
  };
});
