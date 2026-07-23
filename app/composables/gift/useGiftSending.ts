/**
 * Gift Sending Composable
 *
 * Handles gift sending with balance validation, socket emission,
 * and playback triggering.
 */
import type { GiftSendAck } from '~/types/room/audio';
import { announceLocalGiftSend } from '~/composables/room/useRoomEventHandlers';

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
  const log = createLogger('[useGiftSending]');

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
      if (seat.occupantId !== null && seat.occupantId !== currentUserId) {
        ids.add(seat.occupantId);
      }
    }
    return ids;
  }

  /**
   * Unique id grouping all per-recipient emits from ONE send (or ONE combo
   * press). Receivers coalesce events sharing a batchId into a single
   * full-screen playback — so a fan-out to N seats plays once, while each
   * separate combo press (new batchId) plays as its own queued animation.
   *
   * Uses the same timestamp+random scheme as the playback-id in the gift store
   * (NOT crypto.randomUUID, which throws in non-secure contexts like mobile QA
   * over a LAN IP on plain HTTP). Uniqueness is all that's needed here.
   */
  function newBatchId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * REACT: reconcile the optimistic debit for one burst send against its ack.
   * Refunds coins for legs the server dropped (unseated recipients) or, on a
   * total failure (no ack / success:false), refunds the whole tracked amount.
   * Never blocks send()/combo()'s return — always called fire-and-forget.
   */
  function reconcileBurstRefund(
    batchId: string,
    perRecipientCost: number,
    requestedRecipientIds: number[],
    ack: GiftSendAck | null,
  ): void {
    const trackedAmount = comboStore.consumePendingRefund(batchId);
    if (trackedAmount <= 0) return;

    if (!ack || !ack.success) {
      // Total failure — refund everything this burst debited.
      const currentCoins = Number(authStore.user?.coins ?? 0);
      authStore.patchBalance({ coins: String(currentCoins + trackedAmount) });
      return;
    }

    const acceptedIds = ack.acceptedRecipientIds ?? requestedRecipientIds;
    const droppedCount = requestedRecipientIds.filter((id) => !acceptedIds.includes(id)).length;
    if (droppedCount === 0) return;

    // Silent by design (HITL 2026-07-23): a dropped-leg refund is self-healing
    // bookkeeping — surfacing it as a toast spammed busy rooms.
    const refundAmount = perRecipientCost * droppedCount;
    const currentCoins = Number(authStore.user?.coins ?? 0);
    authStore.patchBalance({ coins: String(currentCoins + refundAmount) });
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

    // GATE: the sender must be authenticated. `authStore.user` CAN be null
    // here (session revoked / auth refresh gap) — the old `user!` assertions
    // crashed the whole component tree instead of failing the send.
    const sender = authStore.user;
    if (!sender) {
      toast.add({ title: 'Not signed in', description: 'Please sign in again to send gifts.', color: 'error' });
      return false;
    }

    isSending.value = true;

    try {
      // One batchId for the whole send — every recipient's gift:received carries
      // it so receivers collapse this fan-out into a single playback.
      const batchId = newBatchId();
      const recipientIds = [...selectedRecipients];
      const perRecipientCost = selectedGift.price * selectedQuantity;

      // Track amount for potential rollback, keyed to THIS batch (fixes the
      // scalar last-write-wins bug when sends overlap).
      comboStore.setPendingRefund(batchId, totalCost.value);

      // Optimistic coin deduction
      deductCoins(totalCost.value);

      // Single burst emit for every recipient. emitGift (useRoomGifts.sendGift)
      // owns the sender-side optimistic accumulation (room XP + seat gift value)
      // since the sender is excluded from the gift:received broadcast. Do NOT
      // accumulate here too — that double-counts the seat total for the sender.
      // REACT: reconcile the debit against the ack once it resolves — never
      // blocks this function's optimistic return.
      emitGift(selectedGift.id, recipientIds, selectedQuantity, batchId)
        .then((ack) => reconcileBurstRefund(batchId, perRecipientCost, recipientIds, ack))
        .catch((err: unknown) => {
          log.warn('gift:send failed', err);
          reconcileBurstRefund(batchId, perRecipientCost, recipientIds, null);
        });

      // Start playback immediately (optimistic)
      // Lucky gifts use fly animation, all others use fullscreen playback modal
      if (selectedGift.category === 'lucky') {
        for (const recipientId of selectedRecipients) {
          triggerFly(selectedGift.thumbnail_url, sender.id, recipientId);
        }

        // Activate lucky combo button
        comboStore.setLuckyContext({
          gift: selectedGift,
          senderId: sender.id,
          recipientIds: [...selectedRecipients],
          quantity: selectedQuantity,
        });
        giftStore.resetCombo();
        giftStore.incrementCombo();
      } else {
        // Deactivate lucky combo when switching to non-lucky gift
        endLuckyCombo();

        // Capture this send so the combo button repeats THIS gift, independent
        // of the playback queue (which advances to other gifts as they play).
        comboStore.setNormalContext({
          gift: selectedGift,
          senderId: sender.id,
          recipientIds: [...selectedRecipients],
          quantity: selectedQuantity,
        });

        const playbackItem = {
          gift: selectedGift,
          senderId: sender.id,
          senderName: sender.name ?? 'Unknown',
          senderAvatar: sender.avatar ?? undefined,
          recipientIds: [...selectedRecipients],
          quantity: selectedQuantity,
        };

        // Always enqueue: a new send waits its turn behind whatever is already
        // playing and advances when that finishes, exactly like the gifts other
        // users send. Auto-starts via playNext when nothing is playing.
        giftStore.enqueuePlayback(playbackItem);

        // Seed the combo-streak badge (decoupled from playNext now).
        giftStore.resetCombo();
        giftStore.incrementCombo();

        // Sender-local gift-sent chat bubble (HITL 2026-07-23) — MSAB excludes
        // the sender from `gift:received`, so the sender's own client would
        // otherwise never see this announcement. Non-lucky only: lucky gifts
        // announce solely via the lucky-win slide bubble.
        announceLocalGiftSend(
          {
            senderId: sender.id,
            senderName: sender.name ?? 'Unknown',
            giftId: selectedGift.id,
            quantity: selectedQuantity,
            recipientIds: [...selectedRecipients],
          },
          selectedGift,
        );
      }

      // Quantity intentionally sticks across sends (user choice persists
      // until changed manually — HITL 2026-07-24).
      return true;
    } finally {
      isSending.value = false;
    }
  }

  /**
   * Handle combo click — re-send the last normal gift and enqueue another full
   * playback (never interrupts what's on screen).
   * @returns true if combo was successful
   */
  async function combo(): Promise<boolean> {
    // Repeat the last NORMAL send, not whatever the queue is currently showing.
    const ctx = comboStore.lastNormalContext;

    if (!ctx) {
      return false;
    }

    // GF-017: Filter against currently seated recipients (direct seat read)
    const seatedIds = getSeatedUserIds();
    const validRecipients = ctx.recipientIds.filter(id => seatedIds.has(id));
    if (validRecipients.length === 0) {
      comboStore.clearNormalContext();
      return false;
    }

    const comboCost = ctx.gift.price
      * validRecipients.length
      * ctx.quantity;

    const coins = Number(authStore.user?.coins ?? 0);

    if (coins < comboCost) {
      toast.add({
        title: 'Insufficient balance for combo',
        description: 'Please top up your coins.',
        color: 'error',
      });
      return false;
    }

    // GATE: sender must still be authenticated (see send()) — `user` can be
    // null mid-session and the old `user!` assertions crashed the render tree.
    const sender = authStore.user;
    if (!sender) return false;

    // Fresh batchId per press — each combo is its own queued animation, never
    // interrupting whatever is currently playing.
    const batchId = newBatchId();
    const perRecipientCost = ctx.gift.price * ctx.quantity;

    // Track amount for potential rollback, keyed to THIS batch.
    comboStore.setPendingRefund(batchId, comboCost);

    // Deduct coins for combo
    deductCoins(comboCost);

    // Single burst emit for every valid (seated) recipient. emitGift owns the
    // sender-side optimistic accumulation (see send()) — don't duplicate it here.
    // REACT: reconcile once the ack resolves — never blocks this function's return.
    emitGift(ctx.gift.id, validRecipients, ctx.quantity, batchId)
      .then((ack) => reconcileBurstRefund(batchId, perRecipientCost, validRecipients, ack))
      .catch((err: unknown) => {
        log.warn('gift:send (combo) failed', err);
        reconcileBurstRefund(batchId, perRecipientCost, validRecipients, null);
      });

    // Enqueue a separate playback so the combo plays in order behind whatever is
    // already on screen — same FIFO path as send() and other users' gifts.
    giftStore.enqueuePlayback({
      gift: ctx.gift,
      senderId: sender.id,
      senderName: sender.name ?? 'Unknown',
      senderAvatar: sender.avatar ?? undefined,
      recipientIds: [...validRecipients],
      quantity: ctx.quantity,
    });

    // Increment combo counter (drawer button streak display)
    giftStore.incrementCombo();

    // Sender-local gift-sent chat bubble (see send()) — shares the same
    // module-level streak map, so this patches the sender's own bubble from
    // send() in place rather than creating a second one.
    announceLocalGiftSend(
      {
        senderId: sender.id,
        senderName: sender.name ?? 'Unknown',
        giftId: ctx.gift.id,
        quantity: ctx.quantity,
        recipientIds: [...validRecipients],
      },
      ctx.gift,
    );

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

    // Fresh batchId per press, mirroring combo() — each lucky combo press is its
    // own tracked burst so overlapping presses each reconcile independently.
    const batchId = newBatchId();
    const perRecipientCost = ctx.gift.price * ctx.quantity;

    comboStore.setPendingRefund(batchId, comboCost);

    // Deduct coins and play fly animation
    deductCoins(comboCost);

    // Single burst emit for every valid (seated) recipient. emitGift owns the
    // sender-side optimistic accumulation (see send()) — don't duplicate it here.
    // REACT: reconcile once the ack resolves — never blocks this function's return.
    emitGift(ctx.gift.id, validRecipients, ctx.quantity, batchId)
      .then((ack) => reconcileBurstRefund(batchId, perRecipientCost, validRecipients, ack))
      .catch((err: unknown) => {
        log.warn('gift:send (luckyCombo) failed', err);
        reconcileBurstRefund(batchId, perRecipientCost, validRecipients, null);
      });

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
    () => seatsStore.seats.map(s => s.occupantId ?? null),
    () => {
      const seatedIds = getSeatedUserIds();

      // Auto-end regular combo: disable the combo button when its recipients all
      // leave. Only the combo context is cleared — gifts already on screen / in
      // the queue still finish playing (the queue is never interrupted).
      if (comboStore.lastNormalContext) {
        const hasSeatedRecipient = comboStore.lastNormalContext.recipientIds
          .some(id => seatedIds.has(id));
        if (!hasSeatedRecipient) {
          comboStore.clearNormalContext();
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
