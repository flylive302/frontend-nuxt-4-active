import { defineStore } from 'pinia';
import type { LuckyComboContext } from '~/types/gift/gift';

export const useGiftComboStore = defineStore('giftComboStore', () => {
  // ========================================
  // State
  // ========================================

  const pendingRefund = ref(0);
  const lastLuckyContext = ref<LuckyComboContext | null>(null);
  const isLuckyComboActive = ref(false);

  // ========================================
  // Setters
  // ========================================

  function setPendingRefund(amount: number): void {
    pendingRefund.value = amount;
  }

  function setLuckyContext(ctx: LuckyComboContext): void {
    lastLuckyContext.value = ctx;
    isLuckyComboActive.value = true;
  }

  function clearLuckyContext(): void {
    lastLuckyContext.value = null;
    isLuckyComboActive.value = false;
  }

  // ========================================
  // Reset
  // ========================================

  function $reset(): void {
    pendingRefund.value = 0;
    lastLuckyContext.value = null;
    isLuckyComboActive.value = false;
  }

  // ========================================
  // Return
  // ========================================

  return {
    pendingRefund,
    lastLuckyContext,
    isLuckyComboActive,
    setPendingRefund,
    setLuckyContext,
    clearLuckyContext,
    $reset,
  };
});
