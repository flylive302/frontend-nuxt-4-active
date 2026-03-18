/**
 * Gift Sending Composable
 *
 * Handles gift sending with balance validation, socket emission,
 * and playback triggering.
 */
import type { Gift } from '~/types/gift/gift';


// ========================================
// Types
// ========================================

/** Context for lucky gift combo resending */
interface LuckyComboContext {
  readonly gift: Gift;
  readonly senderId: number;
  readonly recipientIds: readonly number[];
  readonly quantity: number;
}

// ========================================
// Module-level shared state (for use in socket callbacks)
// ========================================

/** Track pending transaction amount for potential rollback */
const _pendingRefund = ref(0);

/** Last sent lucky gift context — drives combo resending */
const _lastLuckyContext = ref<LuckyComboContext | null>(null);

/** Whether the lucky combo button should be visible */
const _isLuckyComboActive = ref(false);

/**
 * Refund coins to user balance (can be called from socket callbacks)
 * This is exported at module level to avoid inject() issues
 */
export function refundPendingCoins(): void {
  if (_pendingRefund.value > 0) {
    const authStore = useAuthStore();
    const currentCoins = Number(authStore.user?.coins ?? 0);
    authStore.patchBalance({ coins: String(currentCoins + _pendingRefund.value) });
    _pendingRefund.value = 0;
  }
}

export function useGiftSending() {
  // ========================================
  // Dependencies
  // ========================================
  const giftStore = useGiftStore();
  const authStore = useAuthStore();
  const roomStore = useRoomStore();
  const { sendGift: emitGift } = useRoomAudio();
  const { triggerFly } = useLuckyFly();
  const toast = useToast();

  // Initialize preload watcher (extracted from gift store — SRP fix)
  useGiftPreload(
    toRef(giftStore, 'selectedGift'),
    toRef(giftStore, 'selectedRecipients')
  );

  // ========================================
  // State
  // ========================================

  /** Prevents double-sending while request is in progress */
  const isSending = ref(false);

  /** Expose module-level pending refund for internal use */
  const pendingRefund = _pendingRefund;

  /** Module-level lucky combo state aliases */
  const lastLuckyContext = _lastLuckyContext;
  const isLuckyComboActive = _isLuckyComboActive;

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
  // Helpers
  // ========================================

  /**
   * GF-017: Get the set of user IDs currently seated in the room.
   * Reads roomStore.seats directly (not through Pinia computed indirection)
   * for guaranteed fresh reactivity.
   */
  function getSeatedUserIds(): Set<number> {
    const currentUserId = authStore.user?.id;
    const ids = new Set<number>();
    for (const seat of roomStore.seats) {
      if (seat.user !== null && seat.user.id !== currentUserId) {
        ids.add(seat.user.id);
      }
    }
    return ids;
  }

  // ========================================
  // Methods
  // ========================================

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

      // Sender-side gift value accumulation (sender is excluded from gift:received broadcast)
      for (const recipientId of selectedRecipients) {
        roomStore.addSeatGiftValue(recipientId, selectedGift.price * selectedQuantity);
      }

      // Start playback immediately (optimistic)
      // Lucky gifts use fly animation, all others use fullscreen playback modal
      if (selectedGift.category === 'lucky') {
        for (const recipientId of selectedRecipients) {
          triggerFly(selectedGift.thumbnail_url, authStore.user!.id, recipientId);
        }

        // Activate lucky combo button
        lastLuckyContext.value = {
          gift: selectedGift,
          senderId: authStore.user!.id,
          recipientIds: [...selectedRecipients],
          quantity: selectedQuantity,
        };
        isLuckyComboActive.value = true;
        giftStore.resetCombo();
        giftStore.incrementCombo();
      } else {
        // Deactivate lucky combo when switching to non-lucky gift
        endLuckyCombo();

        const playbackItem = {
          gift: selectedGift,
          senderId: authStore.user!.id,
          senderName: authStore.user!.name ?? 'Unknown',
          senderAvatar: authStore.user!.avatar ?? undefined,
          recipientIds: [...selectedRecipients],
          quantity: selectedQuantity,
        };

        if (giftStore.isPlaying) {
          // Sender's new gift replaces current playback immediately
          giftStore.interruptAndPlay(playbackItem);
        } else {
          // Nothing playing — enqueue (auto-starts via playNext)
          giftStore.enqueuePlayback(playbackItem);
        }
      }

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

    // GF-017: Filter against currently seated recipients (direct seat read)
    const seatedIds = getSeatedUserIds();
    const validRecipients = currentPlayback.recipientIds.filter(id => seatedIds.has(id));
    if (validRecipients.length === 0) {
      giftStore.clearPlayback();
      return false;
    }

    const comboCost = currentPlayback.gift.price
      * validRecipients.length
      * currentPlayback.quantity;

    const coins = Number(authStore.user?.coins ?? 0);

    if (coins < comboCost) {
      toast.add({
        title: 'Insufficient balance for combo',
        description: 'Please top up your coins.',
        color: 'error',
      });
      return false;
    }

    // Emit socket event for each valid (seated) recipient
    for (const recipientId of validRecipients) {
      emitGift(currentPlayback.gift.id, recipientId, currentPlayback.quantity);
    }

    // Deduct coins for combo
    deductCoins(comboCost);

    // Sender-side gift value accumulation
    for (const recipientId of validRecipients) {
      roomStore.addSeatGiftValue(recipientId, currentPlayback.gift.price * currentPlayback.quantity);
    }

    // Increment combo counter
    giftStore.incrementCombo();

    return true;
  }

  /**
   * Handle lucky combo click — resend same lucky gift, deduct coins, trigger fly.
   * @returns true if combo was successful
   */
  async function luckyCombo(): Promise<boolean> {
    const ctx = lastLuckyContext.value;
    if (!ctx) return false;

    // GF-017: Filter against currently seated recipients (direct seat read)
    const seatedIds = getSeatedUserIds();
    const validRecipients = ctx.recipientIds.filter(id => seatedIds.has(id));
    if (validRecipients.length === 0) {
      endLuckyCombo();
      return false;
    }

    const comboCost = ctx.gift.price * validRecipients.length * ctx.quantity;
    const coins = Number(authStore.user?.coins ?? 0);

    if (coins < comboCost) {
      toast.add({
        title: 'Insufficient balance for combo',
        description: 'Please top up your coins.',
        color: 'error',
      });
      return false;
    }

    // Emit socket event for each valid (seated) recipient
    for (const recipientId of validRecipients) {
      emitGift(ctx.gift.id, recipientId, ctx.quantity);
    }

    // Deduct coins and play fly animation
    deductCoins(comboCost);
    for (const recipientId of validRecipients) {
      triggerFly(ctx.gift.thumbnail_url, ctx.senderId, recipientId);
    }

    // Sender-side gift value accumulation
    for (const recipientId of validRecipients) {
      roomStore.addSeatGiftValue(recipientId, ctx.gift.price * ctx.quantity);
    }

    // Increment combo counter
    giftStore.incrementCombo();

    return true;
  }

  /**
   * End lucky combo (called on combo timeout or when switching to non-lucky gift)
   */
  function endLuckyCombo(): void {
    isLuckyComboActive.value = false;
    lastLuckyContext.value = null;
  }

  /**
   * Deduct coins from user balance (optimistic update)
   */
  function deductCoins(amount: number): void {
    const currentCoins = Number(authStore.user?.coins ?? 0);
    authStore.patchBalance({ coins: String(Math.max(0, currentCoins - amount)) });
  }

  // ========================================
  // GF-017: Auto-end combo when all recipients leave seats
  // ========================================
  watch(
    () => roomStore.seats.map(s => s.user?.id ?? null),
    () => {
      const seatedIds = getSeatedUserIds();

      // Auto-end regular combo
      if (giftStore.currentPlayback) {
        const hasSeatedRecipient = giftStore.currentPlayback.recipientIds
          .some(id => seatedIds.has(id));
        if (!hasSeatedRecipient) {
          giftStore.clearPlayback();
        }
      }

      // Auto-end lucky combo
      if (lastLuckyContext.value) {
        const hasSeatedRecipient = lastLuckyContext.value.recipientIds
          .some(id => seatedIds.has(id));
        if (!hasSeatedRecipient) {
          endLuckyCombo();
        }
      }
    },
    { deep: true },
  );

  // ========================================
  // Return
  // ========================================
  return {
    // State
    isSending,
    pendingRefund,
    isLuckyComboActive: readonly(isLuckyComboActive),

    // Computed
    totalCost,
    canAfford,
    canSend,

    // Methods
    send,
    combo,
    luckyCombo,
    endLuckyCombo,
    deductCoins,
  };
}
