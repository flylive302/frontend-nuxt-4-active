/**
 * Gift Sending Composable
 *
 * Handles gift sending with balance validation, socket emission,
 * and playback triggering.
 */
import type { GiftSendAck } from '~/types/room/audio';
import type { Gift } from '~/types/gift/gift';
import { announceLocalGiftSend } from '~/composables/room/useRoomEventHandlers';
import { recordLuckyGiftTap } from '~/composables/lucky/useLuckyGift';
import {
  GIFT_COMBO_COALESCE_MS,
  GIFT_COMBO_MAX_BURST_QUANTITY,
  GIFT_FAILURE_TOAST_COOLDOWN_MS,
  GIFT_REFUSAL_TOAST_GENERIC,
  GIFT_REFUSAL_TOAST_MESSAGES,
  GIFT_SEND_ERROR,
} from '~/constants/gift';
import { isLuckyCategory } from '~/utils/gift';

export function useGiftSending() {
  // ========================================
  // Dependencies
  // ========================================
  const comboStore = useGiftComboStore();
  const giftStore = useGiftStore();
  const authStore = useAuthStore();
  const seatsStore = useRoomSeatsStore();
  const capabilitiesStore = useServerCapabilitiesStore();
  const { canAfford, canSend } = useGiftEligibility();
  const { sendGift: emitGift, isConnected } = useRoomAudio();
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

  /**
   * Timestamp of the last "gift not sent" toast, throttling the burst-failure
   * message. Plain local state rather than a ref — nothing renders it, and
   * keeping it per-composable-instance means one room's rejections never
   * suppress another's.
   */
  let lastFailureToastAt = 0;

  /**
   * Timestamp of the last "reconnecting" toast — same throttling rationale as
   * `lastFailureToastAt`, separate timer so a burst rejection and a reconnect
   * gap each get to say their piece once.
   */
  let lastReconnectToastAt = 0;

  /**
   * A run of combo() taps against the SAME gift+recipients, waiting to merge
   * into one `gift:send` emit (msab-load-stability — combo tap flood).
   * luckyCombo() does NOT use this — see luckyCombo()'s own comment for why.
   * Not a ref: nothing renders it, and only this closure ever reads or writes
   * it between taps.
   *
   * THROTTLE, not debounce: `flushAt` is fixed the moment the FIRST tap of a
   * burst arrives and never moves — later taps in the same window only add
   * their quantity/refund, they do not push the timer back out. A continuous
   * run of taps therefore emits one merged batch every GIFT_COMBO_COALESCE_MS
   * instead of never flushing until taps stop.
   */
  let pendingBurst: {
    key: string;
    gift: Gift;
    recipientIds: number[];
    /** Summed quantity across every tap folded into this burst so far. */
    totalQuantity: number;
    batchId: string;
    /** Summed total refund (all recipients, all taps) tracked for this batchId. */
    refundTotal: number;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

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
   *
   * Self-gifting (self-gifting epic ticket 04): a seated sender is a seated
   * user like any other, so self is intentionally NOT excluded here anymore —
   * combo()/luckyCombo() and the auto-end-combo watcher below all read this
   * set to decide "is this recipient still seated", and a self-only combo/
   * lucky-combo context must survive that check the same way any other
   * recipient's does.
   */
  function getSeatedUserIds(): Set<number> {
    const ids = new Set<number>();
    for (const seat of seatsStore.seats) {
      if (seat.occupantId !== null) {
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
   * Identity of a combo burst: same gift + same recipient set. Taps sharing a
   * key merge into the same pending burst; a mismatch (gift or recipients
   * changed mid-run) flushes whatever was pending before starting a new one.
   */
  function burstKey(giftId: number, recipientIds: number[]): string {
    return `${giftId}:${[...recipientIds].sort((a, b) => a - b).join(',')}`;
  }

  /**
   * EXECUTE (deferred): send the coalesced `gift:send` for whatever combo
   * burst is pending, then REACT-reconcile its refund once the ack resolves.
   * A no-op if nothing is pending — safe to call unconditionally as a flush
   * trigger (window expiry, context change, or a plain send()).
   */
  function flushComboBurst(): void {
    const burst = pendingBurst;
    if (!burst) return;
    clearTimeout(burst.timer);
    pendingBurst = null;

    // Per-recipient cost for the WHOLE merged batch — mirrors send()/combo()'s
    // single-tap perRecipientCost, just scaled by the summed quantity, so
    // reconcileBurstRefund's partial-drop math (perRecipientCost × droppedCount)
    // stays correct for a batch built from N taps instead of one.
    const perRecipientCost = burst.gift.price * burst.totalQuantity;

    emitGift(burst.gift.id, burst.recipientIds, burst.totalQuantity, burst.batchId)
      .then((ack) => reconcileSend(burst.batchId, perRecipientCost, burst.recipientIds, ack))
      .catch((err: unknown) => {
        log.warn('gift:send (combo burst) failed', err);
        reconcileSend(burst.batchId, perRecipientCost, burst.recipientIds, null);
      });
  }

  /**
   * REACT: dispatch to the ackBalance path or the legacy optimistic-refund
   * path, whichever the connection advertised. Single choke point so every
   * emit site (send/combo/luckyCombo) reconciles the same way.
   */
  function reconcileSend(
    batchId: string,
    perRecipientCost: number,
    requestedRecipientIds: number[],
    ack: GiftSendAck | null,
  ): void {
    if (capabilitiesStore.ackBalance) {
      reconcileAckBalance(ack);
      return;
    }
    reconcileBurstRefund(batchId, perRecipientCost, requestedRecipientIds, ack);
  }

  /**
   * REACT (ackBalance path): the server is the sole source of the balance —
   * no optimistic subtract happened, so there is nothing to refund locally.
   * A success ack's `balance`/`seq` are applied through the sequence-guarded
   * setter; a refusal applies its own (already-refunded) balance/seq the same
   * way and maps `code` to a toast. A dropped emit (no ack) leaves the
   * balance untouched — the next `balance.updated` push self-heals it.
   */
  function reconcileAckBalance(ack: GiftSendAck | null): void {
    if (!ack) {
      notifyRefusal(null);
      return;
    }

    if (ack.balance !== undefined && ack.seq !== undefined) {
      authStore.applyBalance({ coins: ack.balance, seq: ack.seq });
    }

    if (!ack.success) {
      notifyRefusal(ack);
    }
  }

  /**
   * REACT: tell the sender why an ackBalance refusal happened. Throttled on
   * the SAME cooldown as the legacy burst-rejection toast — a rejected combo
   * still emits one refusal per tap, so without this a low-balance 100-tap
   * combo would stack 100 identical toasts.
   */
  function notifyRefusal(ack: GiftSendAck | null): void {
    const now = Date.now();
    if (now - lastFailureToastAt < GIFT_FAILURE_TOAST_COOLDOWN_MS) return;
    lastFailureToastAt = now;

    const description = ack?.code
      ? (GIFT_REFUSAL_TOAST_MESSAGES[ack.code] ?? GIFT_REFUSAL_TOAST_GENERIC)
      : GIFT_REFUSAL_TOAST_GENERIC;

    toast.add({
      title: 'Gift not sent',
      description,
      color: 'error',
    });
  }

  /**
   * GATE has already passed and this tap's coins are already debited by the
   * time this runs — this only decides whether the tap's `gift:send` joins an
   * in-flight burst or starts a new one, arming the throttle timer only on
   * the burst's first tap (see `pendingBurst`'s comment for why).
   *
   * @param tapTotalCost total coin cost of THIS tap alone (all recipients),
   *   accumulated into the batch's tracked refund amount.
   */
  function queueComboBurst(
    gift: Gift,
    recipientIds: number[],
    tapQuantity: number,
    tapTotalCost: number,
  ): void {
    const key = burstKey(gift.id, recipientIds);

    // Same gift+recipients AND under MSAB's wire-level quantity cap (see
    // GIFT_COMBO_MAX_BURST_QUANTITY) — merge into the pending burst. THROTTLE:
    // the burst's timer was armed by its FIRST tap and is never reset here, so
    // a continuous run of taps still flushes every GIFT_COMBO_COALESCE_MS
    // instead of being pushed out indefinitely.
    if (
      pendingBurst
      && pendingBurst.key === key
      && pendingBurst.totalQuantity + tapQuantity <= GIFT_COMBO_MAX_BURST_QUANTITY
    ) {
      pendingBurst.totalQuantity += tapQuantity;
      pendingBurst.refundTotal += tapTotalCost;
      // ackBalance: nothing was optimistically debited, so there is nothing
      // to track for a local refund — the server's balance is authoritative.
      if (!capabilitiesStore.ackBalance) {
        comboStore.setPendingRefund(pendingBurst.batchId, pendingBurst.refundTotal);
      }
      return;
    }

    // Different gift/recipients (or nothing pending) — flush whatever was
    // queued immediately, then start a fresh burst for this tap.
    flushComboBurst();

    const batchId = newBatchId();
    if (!capabilitiesStore.ackBalance) {
      comboStore.setPendingRefund(batchId, tapTotalCost);
    }
    pendingBurst = {
      key,
      gift,
      recipientIds: [...recipientIds],
      totalQuantity: tapQuantity,
      batchId,
      refundTotal: tapTotalCost,
      timer: setTimeout(flushComboBurst, GIFT_COMBO_COALESCE_MS),
    };
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
      // Total failure — refund everything this burst debited, and SAY SO. The
      // refund alone used to be the entire response: a rejected burst put the
      // coins back and played the animation, so a run of taps against an
      // unseated recipient looked identical to a run that worked.
      const currentCoins = Number(authStore.user?.coins ?? 0);
      authStore.patchBalance({ coins: String(currentCoins + trackedAmount) });
      notifyBurstFailure(ack);
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

  /**
   * REACT: tell the sender why a whole burst was rejected.
   *
   * Throttled, because a combo emits once per tap: without the cooldown a
   * twenty-tap run against an unseated recipient would stack twenty identical
   * toasts. Partial-leg drops never reach here — those stay silent by design
   * (HITL 2026-07-23).
   */
  function notifyBurstFailure(ack: GiftSendAck | null): void {
    const now = Date.now();
    if (now - lastFailureToastAt < GIFT_FAILURE_TOAST_COOLDOWN_MS) return;
    lastFailureToastAt = now;

    toast.add({
      title: 'Gift not sent',
      description: describeSendFailure(ack),
      color: 'error',
    });
  }

  /**
   * Map a `gift:send` ack failure to something the sender can act on.
   *
   * Every branch states the refund explicitly: the coins are already back in
   * the balance by the time this runs, and a silent re-credit reads as a
   * double charge to anyone watching the number.
   */
  function describeSendFailure(ack: GiftSendAck | null): string {
    if (!ack) {
      return 'Could not reach the room server. Your coins were refunded.';
    }

    switch (ack.error) {
      case GIFT_SEND_ERROR.NO_RECIPIENTS_SEATED:
        return 'The people you picked need to be on a mic seat. Your coins were refunded.';
      case GIFT_SEND_ERROR.NOT_IN_ROOM:
        return 'You are no longer in this room. Rejoin and try again — your coins were refunded.';
      case GIFT_SEND_ERROR.RATE_LIMITED:
        return 'Sending too fast. Wait a moment and try again — your coins were refunded.';
      default:
        return `${ack.error ?? 'The room server rejected it'}. Your coins were refunded.`;
    }
  }

  /**
   * GATE: the room socket must be live before any coins move.
   *
   * A tap while the socket was down/reconnecting used to be accepted anyway:
   * optimistically debited, guaranteed to fail (`sendGift` returns null on a
   * missing socket, and an in-flight emit rejects on disconnect), then
   * refunded with "Could not reach the room server" — a charge-then-refund
   * churn that reads as a failed payment during rapid combos. Rejecting here
   * moves the failure BEFORE the debit: nothing moves, one throttled toast.
   */
  function gateRoomConnection(): boolean {
    if (isConnected.value) return true;

    const now = Date.now();
    if (now - lastReconnectToastAt >= GIFT_FAILURE_TOAST_COOLDOWN_MS) {
      lastReconnectToastAt = now;
      toast.add({
        title: 'Reconnecting to the room',
        description: 'One moment — no coins were taken. Try again when the connection is back.',
        color: 'warning',
      });
    }

    return false;
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

    // A non-combo send never waits behind a coalescing window — flush
    // whatever combo burst is pending immediately, as its own smaller emit.
    flushComboBurst();

    // GATE: refuse before the debit while the socket is down — see gateRoomConnection.
    if (!gateRoomConnection()) return false;

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

      // With ackBalance, the server is the sole source of the balance — no
      // optimistic subtract, no local refund tracking (ticket 13). Without
      // it, track amount for potential rollback, keyed to THIS batch (fixes
      // the scalar last-write-wins bug when sends overlap), and debit now.
      if (!capabilitiesStore.ackBalance) {
        comboStore.setPendingRefund(batchId, totalCost.value);
        deductCoins(totalCost.value);
      }

      // Single burst emit for every recipient. emitGift (useRoomGifts.sendGift)
      // owns the sender-side optimistic accumulation (room XP + seat gift value)
      // since the sender is excluded from the gift:received broadcast. Do NOT
      // accumulate here too — that double-counts the seat total for the sender.
      // REACT: reconcile the debit against the ack once it resolves — never
      // blocks this function's optimistic return.
      emitGift(selectedGift.id, recipientIds, selectedQuantity, batchId)
        .then((ack) => reconcileSend(batchId, perRecipientCost, recipientIds, ack))
        .catch((err: unknown) => {
          log.warn('gift:send failed', err);
          reconcileSend(batchId, perRecipientCost, recipientIds, null);
        });

      // Start playback immediately (optimistic)
      // Lucky gifts use fly animation, all others use fullscreen playback modal.
      // Self-gifting (self-gifting epic ticket 04): these loops/enqueues run
      // unconditionally over `selectedRecipients`, which now (post-eligibility
      // fix) may include the sender's own id — so a self leg already gets the
      // exact same fly/playback FX as every other recipient, with no extra
      // branch needed. Do not add a separate "is this recipient me" echo path
      // here — that would double-fire the FX for self.
      if (isLuckyCategory(selectedGift.category)) {
        for (const recipientId of selectedRecipients) {
          triggerFly(selectedGift.thumbnail_url, sender.id, recipientId);
        }

        // Sender-local band tap — MSAB excludes the sender from
        // `gift:received`, so the sender's own activity band updates here.
        recordLuckyGiftTap({
          senderId: sender.id,
          senderName: sender.name ?? 'Unknown',
          senderAvatar: sender.avatar ?? null,
          giftName: selectedGift.label ?? selectedGift.name,
          recipientIds: [...selectedRecipients],
          quantity: selectedQuantity,
        });

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

    // GATE: refuse before the debit while the socket is down — see gateRoomConnection.
    if (!gateRoomConnection()) return false;

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

    // Deduct coins for combo — PER TAP, optimistic, so the balance moves
    // instantly even though the network emit below may be coalesced.
    // ackBalance: no optimistic subtract at all — the balance only ever moves
    // via the server's applyBalance-guarded push/ack (ticket 13).
    if (!capabilitiesStore.ackBalance) {
      deductCoins(comboCost);
    }

    // Queue (rather than immediately emit) this tap's `gift:send` — taps
    // landing within GIFT_COMBO_COALESCE_MS of each other merge into one
    // emit with a summed quantity (msab-load-stability — combo tap flood).
    // Refund tracking is keyed to the (possibly merged) batch, not this tap.
    queueComboBurst(ctx.gift, validRecipients, ctx.quantity, comboCost);

    // Enqueue a separate playback so the combo plays in order behind whatever is
    // already on screen — same FIFO path as send() and other users' gifts.
    // Self-gifting: `validRecipients` may include self (getSeatedUserIds no
    // longer excludes the sender) — already covered, no extra branch needed.
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
   *
   * Deliberately NOT coalesced, unlike combo(). Laravel runs exactly ONE lucky
   * draw per constituent burst PER `gift:send` emit (see
   * backend/app/Services/Gift/GiftTransactionService.php:222-228 —
   * `$drawQuantities` is derived one-for-one from the bursts on the request).
   * Merging N taps into a single emit with quantity N would collapse N
   * independent draws into ONE draw staked at N× — a gameplay change, not
   * just a network optimization. So every tap here sends its own `gift:send`,
   * same as before combo coalescing was added for the non-lucky path.
   *
   * @returns true if combo was successful
   */
  async function luckyCombo(): Promise<boolean> {
    const ctx = comboStore.lastLuckyContext;
    if (!ctx) return false;

    // GATE: refuse before the debit while the socket is down — see gateRoomConnection.
    if (!gateRoomConnection()) return false;

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

    // EXECUTE: optimistic per-tap deduction, then this tap's own `gift:send`
    // emit — one draw per tap, never merged (see the function comment above).
    // ackBalance: no optimistic subtract/tracking — see combo()'s comment.
    const batchId = newBatchId();
    const perRecipientCost = ctx.gift.price * ctx.quantity;
    if (!capabilitiesStore.ackBalance) {
      deductCoins(comboCost);
      comboStore.setPendingRefund(batchId, comboCost);
    }

    emitGift(ctx.gift.id, validRecipients, ctx.quantity, batchId)
      .then((ack) => reconcileSend(batchId, perRecipientCost, validRecipients, ack))
      .catch((err: unknown) => {
        log.warn('gift:send (lucky combo) failed', err);
        reconcileSend(batchId, perRecipientCost, validRecipients, null);
      });

    // Self-gifting: `validRecipients` may include self — already covered by
    // this unconditional loop, no extra branch needed.
    for (const recipientId of validRecipients) {
      triggerFly(ctx.gift.thumbnail_url, ctx.senderId, recipientId);
    }

    // Sender-local band tap — same reasoning as send()'s lucky branch.
    recordLuckyGiftTap({
      senderId: ctx.senderId,
      senderName: authStore.user?.name ?? 'Unknown',
      senderAvatar: authStore.user?.avatar ?? null,
      giftName: ctx.gift.label ?? ctx.gift.name,
      recipientIds: validRecipients,
      quantity: ctx.quantity,
    });

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
