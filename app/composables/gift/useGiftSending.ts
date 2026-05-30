/**
 * Gift Sending Composable
 *
 * Handles gift sending with balance validation, socket emission,
 * and playback triggering.
 */
export function useGiftSending() {
  // ========================================
  // Dependencies
  // ========================================
  const comboStore = useGiftComboStore();
  const giftStore = useGiftStore();
  const authStore = useAuthStore();
  const seatsStore = useRoomSeatsStore();
  const { canAfford, canSend } = useGiftEligibility();
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

  // ========================================
  // Computed
  // ========================================

  /**
   * Total cost for current selection
   */
  const totalCost = computed(() => giftStore.totalCost);

  // ========================================
  // Helpers
  // ========================================

  /**
   * GF-017: Get the set of user IDs currently seated in the room.
   * Reads seatsStore.seats directly (not through Pinia computed indirection)
   * for guaranteed fresh reactivity.
   */
  function getSeatedUserIds(): Set<number> {
    const currentUserId = authStore.user?.id;
    const ids = new Set<number>();
    for (const seat of seatsStore.seats) {
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
      comboStore.setPendingRefund(totalCost.value);

      // Optimistic coin deduction
      deductCoins(totalCost.value);

      // Emit socket event for each recipient. emitGift (useRoomGifts.sendGift)
      // owns the sender-side optimistic accumulation (room XP + seat gift value)
      // since the sender is excluded from the gift:received broadcast. Do NOT
      // accumulate here too — that double-counts the seat total for the sender.
      for (const recipientId of selectedRecipients) {
        emitGift(selectedGift.id, recipientId, selectedQuantity);
      }

      // Start playback immediately (optimistic)
      // Lucky gifts use fly animation, all others use fullscreen playback modal
      if (selectedGift.category === 'lucky') {
        for (const recipientId of selectedRecipients) {
          triggerFly(selectedGift.thumbnail_url, authStore.user!.id, recipientId);
        }

        // Activate lucky combo button
        comboStore.setLuckyContext({
          gift: selectedGift,
          senderId: authStore.user!.id,
          recipientIds: [...selectedRecipients],
          quantity: selectedQuantity,
        });
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

    // Emit socket event for each valid (seated) recipient. emitGift owns the
    // sender-side optimistic accumulation (see send()) — don't duplicate it here.
    for (const recipientId of validRecipients) {
      emitGift(currentPlayback.gift.id, recipientId, currentPlayback.quantity);
    }

    // Deduct coins for combo
    deductCoins(comboCost);

    // Increment combo counter
    giftStore.incrementCombo();

    return true;
  }

  /**
   * Handle lucky combo click — resend same lucky gift, deduct coins, trigger fly.
   * @returns true if combo was successful
   */
  async function luckyCombo(): Promise<boolean> {
    const ctx = comboStore.lastLuckyContext;
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

    // Emit socket event for each valid (seated) recipient. emitGift owns the
    // sender-side optimistic accumulation (see send()) — don't duplicate it here.
    for (const recipientId of validRecipients) {
      emitGift(ctx.gift.id, recipientId, ctx.quantity);
    }

    // Deduct coins and play fly animation
    deductCoins(comboCost);
    for (const recipientId of validRecipients) {
      triggerFly(ctx.gift.thumbnail_url, ctx.senderId, recipientId);
    }

    // Increment combo counter
    giftStore.incrementCombo();

    return true;
  }

  /**
   * End lucky combo (called on combo timeout or when switching to non-lucky gift)
   */
  function endLuckyCombo(): void {
    comboStore.clearLuckyContext();
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
    () => seatsStore.seats.map(s => s.user?.id ?? null),
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
      if (comboStore.lastLuckyContext) {
        const hasSeatedRecipient = comboStore.lastLuckyContext.recipientIds
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
