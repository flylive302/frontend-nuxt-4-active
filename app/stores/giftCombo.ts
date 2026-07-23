import { defineStore } from 'pinia';
import type { GiftComboContext } from '~/types/gift/gift';

/** Safety cap on tracked in-flight refunds — evicts the oldest entry if a batch's
 *  ack/error never arrives (disconnect mid-flight), so the map can't grow unbounded. */
const PENDING_REFUNDS_CAP = 100;

export const useGiftComboStore = defineStore('giftComboStore', () => {
  // ========================================
  // State
  // ========================================

  /**
   * Refundable coin amount per in-flight send, keyed by batchId. Replaces the
   * old scalar `pendingRefund` — a single shared number let overlapping sends
   * clobber each other's refund tracking (last-write-wins bug).
   */
  const pendingRefunds = ref(new Map<string, number>());
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

  /** Record the full amount debited for a send, keyed by its batchId. */
  function setPendingRefund(batchId: string, amount: number): void {
    pendingRefunds.value.set(batchId, amount);
    if (pendingRefunds.value.size > PENDING_REFUNDS_CAP) {
      const oldestKey = pendingRefunds.value.keys().next().value;
      if (oldestKey !== undefined) pendingRefunds.value.delete(oldestKey);
    }
  }

  /**
   * Remove and return the refundable amount tracked for a batchId (0 if none —
   * already reconciled, or never tracked).
   */
  function consumePendingRefund(batchId: string): number {
    const amount = pendingRefunds.value.get(batchId) ?? 0;
    pendingRefunds.value.delete(batchId);
    return amount;
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
    pendingRefunds.value.clear();
    lastLuckyContext.value = null;
    isLuckyComboActive.value = false;
    lastNormalContext.value = null;
  }

  // ========================================
  // Return
  // ========================================

  return {
    pendingRefunds,
    lastLuckyContext,
    isLuckyComboActive,
    lastNormalContext,
    setPendingRefund,
    consumePendingRefund,
    setLuckyContext,
    clearLuckyContext,
    setNormalContext,
    clearNormalContext,
    $reset,
  };
});
