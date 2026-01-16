/**
 * Gift Sending Composable
 *
 * Handles gift sending with balance validation, socket emission,
 * and playback triggering.
 */
import type { Gift } from '~/types/gift';

// ========================================
// Module-level shared state (for use in socket callbacks)
// ========================================

/** Track pending transaction amount for potential rollback */
const _pendingRefund = ref(0);

/**
 * Refund coins to user balance (can be called from socket callbacks)
 * This is exported at module level to avoid inject() issues
 */
export function refundPendingCoins(): void {
  if (_pendingRefund.value > 0) {
    const authStore = useAuthStore();
    if (authStore.user) {
      const currentCoins = Number(authStore.user.coins ?? 0);
      authStore.user.coins = String(currentCoins + _pendingRefund.value);
    }
    _pendingRefund.value = 0;
  }
}

export function useGiftSending() {
  // ========================================
  // Dependencies
  // ========================================
  const giftStore = useGiftStore();
  const authStore = useAuthStore();
  const { sendGift: emitGift } = useRoomAudio();
  const toast = useToast();

  // ========================================
  // State
  // ========================================

  /** Prevents double-sending while request is in progress */
  const isSending = ref(false);

  /** Expose module-level pending refund for internal use */
  const pendingRefund = _pendingRefund;

  // ========================================
  // Computed
  // ========================================

  /**
   * Total cost for current selection
   */
  const totalCost = computed(() => giftStore.totalCost);

  /**
   * Whether user can afford current selection
   */
  const canAfford = computed(() => giftStore.canAfford);

  /**
   * Whether send is allowed
   */
  const canSend = computed(() => giftStore.canSend);

  // ========================================
  // Methods
  // ========================================

  /**
   * Calculate cost for a specific gift/recipients/quantity combination
   */
  function calculateCost(gift: Gift, recipientCount: number, quantity: number): number {
    return gift.price * recipientCount * quantity;
  }

  /**
   * Check if user can afford a specific amount
   */
  function checkBalance(amount: number): boolean {
    const coins = Number(authStore.user?.coins ?? 0);
    return coins >= amount;
  }

  /**
   * Send the currently selected gift to selected recipients
   * @returns true if send was successful
   */
  async function send(): Promise<boolean> {
    // Prevent double-sending
    if (isSending.value) return false;

    const { selectedGift, selectedRecipients, selectedQuantity } = giftStore;

    // Validation
    if (!selectedGift) {
      toast.add({ title: 'No gift selected', color: 'warning' });
      return false;
    }

    if (selectedRecipients.length === 0) {
      toast.add({ title: 'No recipients selected', color: 'warning' });
      return false;
    }

    if (!canAfford.value) {
      toast.add({
        title: 'Insufficient balance',
        description: 'Please top up your coins to send this gift.',
        color: 'error',
      });
      return false;
    }

    isSending.value = true;

    try {
      // Track amount for potential rollback
      pendingRefund.value = totalCost.value;

      // Optimistic coin deduction
      deductCoins(totalCost.value);

      // Emit socket event for each recipient
      for (const recipientId of selectedRecipients) {
        emitGift(selectedGift.id, recipientId, selectedQuantity);
      }

      // Start playback immediately (optimistic)
      giftStore.enqueuePlayback({
        gift: selectedGift,
        senderId: authStore.user!.id,
        senderName: authStore.user!.name ?? 'Unknown',
        senderAvatar: authStore.user!.avatar ?? undefined,
        recipientIds: [...selectedRecipients],
        quantity: selectedQuantity,
      });

      // Reset selection for next send
      giftStore.setQuantity(1);

      return true;
    } finally {
      isSending.value = false;
    }
  }

  /**
   * Handle combo click - replay current gift and deduct coins again
   * @returns true if combo was successful
   */
  async function combo(): Promise<boolean> {
    const currentPlayback = giftStore.currentPlayback;

    if (!currentPlayback) {
      return false;
    }

    const comboCost = calculateCost(
      currentPlayback.gift,
      currentPlayback.recipientIds.length,
      currentPlayback.quantity
    );

    if (!checkBalance(comboCost)) {
      toast.add({
        title: 'Insufficient balance for combo',
        description: 'Please top up your coins.',
        color: 'error',
      });
      return false;
    }

    // Emit socket event for each recipient again
    for (const recipientId of currentPlayback.recipientIds) {
      emitGift(currentPlayback.gift.id, recipientId, currentPlayback.quantity);
    }

    // Deduct coins for combo
    deductCoins(comboCost);

    // Increment combo counter
    giftStore.incrementCombo();

    return true;
  }

  /**
   * Deduct coins from user balance (optimistic update)
   */
  function deductCoins(amount: number): void {
    if (authStore.user) {
      const currentCoins = Number(authStore.user.coins ?? 0);
      authStore.user.coins = String(Math.max(0, currentCoins - amount));
    }
  }

  /**
   * Refund coins to user balance (called on error rollback)
   */
  function refundCoins(amount: number): void {
    if (authStore.user && amount > 0) {
      const currentCoins = Number(authStore.user.coins ?? 0);
      authStore.user.coins = String(currentCoins + amount);
    }
  }

  // ========================================
  // Return
  // ========================================
  return {
    // State
    isSending,
    pendingRefund,

    // Computed
    totalCost,
    canAfford,
    canSend,

    // Methods
    calculateCost,
    checkBalance,
    send,
    combo,
    deductCoins,
    refundCoins,
  };
}
