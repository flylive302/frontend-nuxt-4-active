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
   * Coins the sender has WON since the current lucky combo started — the sum
   * of their own `lucky:result` `coins_won`, shown as "+N won this combo".
   * Display-only: it is never added to, or subtracted from, the balance store
   * (the balance only ever moves via sequence-guarded acks/pushes). Reset when
   * a combo starts and when it ends.
   */
  const luckyComboWonCoins = ref(0);
  /**
   * True while the floating lucky combo button is paused after a server
   * refusal (gift-cashback-latency 06). The composable owns the timer that
   * clears it; this is just the flag the button renders `disabled` from.
   */
  const isLuckyComboPaused = ref(false);
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

  /** A lucky combo starts: fresh "won this combo" sum, button enabled. */
  function setLuckyContext(ctx: GiftComboContext): void {
    lastLuckyContext.value = ctx;
    isLuckyComboActive.value = true;
    luckyComboWonCoins.value = 0;
    isLuckyComboPaused.value = false;
  }

  /** The lucky combo ends: drop its context, its won-sum and any pause. */
  function clearLuckyContext(): void {
    lastLuckyContext.value = null;
    isLuckyComboActive.value = false;
    luckyComboWonCoins.value = 0;
    isLuckyComboPaused.value = false;
  }

  /** Add a (frame-coalesced) batch of the sender's own wins to this combo's sum. */
  function addLuckyComboWon(delta: number): void {
    luckyComboWonCoins.value += delta;
  }

  function setLuckyComboPaused(paused: boolean): void {
    isLuckyComboPaused.value = paused;
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
    luckyComboWonCoins.value = 0;
    isLuckyComboPaused.value = false;
    lastNormalContext.value = null;
  }

  // ========================================
  // Return
  // ========================================

  return {
    pendingRefunds,
    lastLuckyContext,
    isLuckyComboActive,
    luckyComboWonCoins,
    isLuckyComboPaused,
    lastNormalContext,
    setPendingRefund,
    consumePendingRefund,
    setLuckyContext,
    clearLuckyContext,
    addLuckyComboWon,
    setLuckyComboPaused,
    setNormalContext,
    clearNormalContext,
    $reset,
  };
});
