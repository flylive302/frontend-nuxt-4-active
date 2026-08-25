/**
 * Room Event Handlers Composable
 *
 * Handles all socket event listeners for room audio.
 * Extracted from useRoomAudio.ts for modularity.
 */
import type {
  RoomParticipant,
  UserJoinedEvent,
  UserLeftEvent,
  RoomClosedEvent,
  RoomModeChangedEvent,
  NewProducerEvent,
  ProducerClosedEvent,
  ProducerSource,
  ChatMessageEvent,
  GiftReceivedEvent,
  GiftBatchEvent,
  GiftErrorEvent,
  GiftPrepareEvent,
  ActiveSpeakerEvent,
  SeatUpdatedEvent,
  SeatClearedEvent,
  SeatEvictedEvent,
  SeatUserMutedEvent,
  SeatLockedEvent,
  SeatInviteReceivedEvent,
  SeatReactionEvent,
} from '~/types/room/audio';
import type { AudioSocket } from './useAudioSocket';
import { useRoomXpAccumulator } from './useRoomXpAccumulator';
import { setupLuckyEventHandlers, cleanupLuckyEventHandlers, recordLuckyGiftTap, handleLuckyRoomResult } from '../lucky/useLuckyGift';
import { useLuckyFly } from '../lucky/useLuckyFly';
import * as giftAssetCache from '~/services/giftAssetCache';
import { resolveSvgaPlugin } from '../gift/useSvgaPlugin';
import { propToEntryAnimationGift } from '~/utils/prop';
import { isLuckyCategory } from '~/utils/gift';
import { createLogger } from '~/utils/logger';
import { SPEAKER_ACTIVE_TTL_MS, CHAT_MESSAGE_TYPE_GIFT } from '~/constants/room';
import { COMBO_BUTTON_TIMEOUT_MS, GIFT_REFUND_TOAST_COOLDOWN_MS, GIFT_REFUND_TOAST_MESSAGE, MAX_PLAYBACK_REPEATS } from '~/constants/gift';
import type { Gift } from '~/types/gift/gift';

const log = createLogger('[RoomEvents]');

/**
 * Legs (batchId:recipientId) already accumulated from `gift:received`. A
 * burst-shaped event (recipientIds[]) and its N legacy singular siblings
 * (recipientId) carry the SAME batchId and describe the SAME legs — without
 * this gate, whichever shape arrives second would double-book seat/XP
 * accumulation for a recipient already credited by the other shape. Events
 * without a batchId (un-upgraded MSAB) skip the gate entirely — no coalescing
 * partner to dedupe against.
 */
const seenGiftLegs = new Set<string>();
const SEEN_GIFT_LEGS_CAP = 1000;

function hasSeenGiftLeg(batchId: string, recipientId: number): boolean {
  const key = `${batchId}:${recipientId}`;
  if (seenGiftLegs.has(key)) return true;
  seenGiftLegs.add(key);
  if (seenGiftLegs.size > SEEN_GIFT_LEGS_CAP) {
    seenGiftLegs.delete(seenGiftLegs.values().next().value!);
  }
  return false;
}

/**
 * `gift:batch` transaction ids already processed (gift-authority-tick-fanout
 * ticket 15). Guards against a re-delivered/duplicate tick (reconnect replay)
 * double-booking XP/chat/playback — the merge key server-side already
 * guarantees one item per (sender, gift, recipient set) per tick, so this is
 * a pure safety net, not the primary legacy/batch overlap guard.
 *
 * De-dup decision for the legacy+batch rollout overlap (`GIFT_LEGACY_SHAPE`
 * on together with the tick): legacy `gift:received` carries NO transaction
 * id (only the `gift:send` ack does), so a transaction-id dedup against
 * legacy is not possible. Instead, once this connection's `server:capabilities`
 * says `giftBatch` is true, `gift:batch` becomes this client's SOLE source of
 * truth for gift XP/chat/playback/lucky taps — the `gift:received` handler
 * below short-circuits entirely while the capability holds. That is a
 * deterministic, connection-scoped choice: exactly one of the two shapes is
 * ever applied, so an overlap during rollout can never double count.
 */
const seenGiftBatchTxIds = new Set<string>();
const SEEN_GIFT_BATCH_TX_IDS_CAP = 2000;

function markGiftBatchTxIdsSeen(transactionIds: string[]): boolean {
  const allSeen = transactionIds.length > 0 && transactionIds.every((id) => seenGiftBatchTxIds.has(id));
  for (const id of transactionIds) {
    seenGiftBatchTxIds.add(id);
    if (seenGiftBatchTxIds.size > SEEN_GIFT_BATCH_TX_IDS_CAP) {
      seenGiftBatchTxIds.delete(seenGiftBatchTxIds.values().next().value!);
    }
  }
  return allSeen;
}

/**
 * Chat gift-announcement streak tracker (lucky-burst-draw ticket 10), keyed by
 * (senderId, giftId, sorted recipientIds) — NOT batchId. `useGiftSending`'s
 * `combo()` mints a FRESH batchId per press (so the playback queue animates
 * each combo tap separately, see `seenBatchIds` in the gift store), so batchId
 * cannot double as "same combo streak" for the chat bubble. This key
 * identifies a repeated send of the same gift to the same recipient set,
 * which is what "one bubble per streak, patched in place" actually means.
 * A streak expires (and is deleted) after COMBO_BUTTON_TIMEOUT_MS of
 * inactivity, mirroring the combo button's own lifetime.
 */
interface GiftChatStreak {
  messageId: string;
  quantity: number;
  totalCoins: number;
  timer: ReturnType<typeof setTimeout>;
}

const giftChatStreaks = new Map<string, GiftChatStreak>();

function giftChatStreakKey(senderId: number, giftId: number, recipientIds: number[]): string {
  return `${senderId}:${giftId}:${[...recipientIds].sort((a, b) => a - b).join(',')}`;
}

/**
 * Compose the gift-sent announcement copy (lucky-burst-draw ticket 05/10).
 * Single recipient names them; multiple recipients collapse to a seat count.
 */
function formatGiftChatContent(
  senderName: string,
  giftLabel: string,
  quantity: number,
  recipientIds: number[],
  recipientName: string | undefined,
  totalCoins: number,
): string {
  const target = recipientIds.length === 1 ? (recipientName ?? 'a recipient') : `${recipientIds.length} seats`;
  return `${senderName} sent ${giftLabel} ×${quantity} to ${target} — ${totalCoins.toLocaleString('en-US')} coins`;
}

/**
 * Minimal shape synthesis needs off a `gift:received` event (or a
 * FE-synthetic stand-in for the sender's own send — see
 * `announceLocalGiftSend`). Deliberately NOT `GiftReceivedEvent` — decoupling
 * from the wire shape lets the sender-local call site build a plain object
 * instead of faking wire fields (e.g. `recipientId`) it doesn't have.
 */
interface GiftChatSourceEvent {
  senderId: number;
  giftId: number;
  quantity: number;
}

/**
 * EXECUTE + REACT: synthesize/patch the gift-sent chat bubble for a
 * burst-shaped `gift:received` event (recipientIds present). Legacy singular
 * siblings of the same burst (scalar recipientId only) are never passed in
 * here — see the call site — so they can never double-announce.
 *
 * `senderNameOverride` lets the sender's own local synthesis (see
 * `announceLocalGiftSend`) use the auth user's name directly — the sender may
 * not have an entry in `participantsStore` to resolve from.
 */
function synthesizeGiftChatMessage(
  audioStore: ReturnType<typeof useRoomAudioStore>,
  participantsStore: ReturnType<typeof useRoomParticipantsStore>,
  event: GiftChatSourceEvent,
  gift: Gift,
  recipientIds: number[],
  senderNameOverride?: string,
): void {
  if (recipientIds.length === 0) return;

  const senderName = senderNameOverride ?? participantsStore.participants.get(event.senderId)?.name ?? 'Someone';
  const giftLabel = gift.label ?? gift.name;
  const recipientName = recipientIds.length === 1
    ? participantsStore.participants.get(recipientIds[0]!)?.name
    : undefined;
  const addedCoins = gift.price * event.quantity * recipientIds.length;

  const key = giftChatStreakKey(event.senderId, event.giftId, recipientIds);
  const existing = giftChatStreaks.get(key);
  // The tracked bubble may have scrolled out of the MAX_CHAT_MESSAGES window —
  // patching a message id that's gone would silently no-op, so start fresh.
  const stillTracked = existing && audioStore.messages.some((m) => m.id === existing.messageId);

  if (existing && stillTracked) {
    clearTimeout(existing.timer);
    existing.quantity += event.quantity;
    existing.totalCoins += addedCoins;
    audioStore.patchMessageContent(
      existing.messageId,
      formatGiftChatContent(senderName, giftLabel, existing.quantity, recipientIds, recipientName, existing.totalCoins),
    );
    existing.timer = setTimeout(() => giftChatStreaks.delete(key), COMBO_BUTTON_TIMEOUT_MS);
    return;
  }

  const messageId = `gift-${key}-${Date.now()}`;
  audioStore.addMessage({
    id: messageId,
    userId: event.senderId,
    content: formatGiftChatContent(senderName, giftLabel, event.quantity, recipientIds, recipientName, addedCoins),
    type: CHAT_MESSAGE_TYPE_GIFT,
    timestamp: Date.now(),
  });
  giftChatStreaks.set(key, {
    messageId,
    quantity: event.quantity,
    totalCoins: addedCoins,
    timer: setTimeout(() => giftChatStreaks.delete(key), COMBO_BUTTON_TIMEOUT_MS),
  });
}

/**
 * Sender-side gift-sent chat bubble (lucky-burst-draw ticket 10 follow-up,
 * HITL 2026-07-23): MSAB excludes the sender from `gift:received`, so the
 * sender's own client never runs `synthesizeGiftChatMessage` off the
 * broadcast. `useGiftSending`'s `send()`/`combo()` REACT sections call this
 * directly with a synthetic source built from the local send — NOT
 * `luckyCombo()`, since lucky-category gifts announce only via the lucky-win
 * slide bubble (see the `!isLuckyCategory(category)` gate on the `gift:received`
 * call site below). Shares the same module-level streak map, so a sender's
 * own combo taps patch the same bubble in place, and the streak key still
 * dedupes naturally against a same-batch `gift:received` for the sender,
 * should one ever arrive.
 */
export function announceLocalGiftSend(
  params: {
    senderId: number;
    senderName: string;
    giftId: number;
    quantity: number;
    recipientIds: number[];
  },
  gift: Gift,
): void {
  const audioStore = useRoomAudioStore();
  const participantsStore = useRoomParticipantsStore();
  synthesizeGiftChatMessage(
    audioStore,
    participantsStore,
    { senderId: params.senderId, giftId: params.giftId, quantity: params.quantity },
    gift,
    params.recipientIds,
    params.senderName,
  );
}

/**
 * Decay timer for speaking indicators. MSAB never emits an "all silent"
 * event, so the last `speaker:active` set would stick forever without this.
 * Module-level because there is a single audio socket per app.
 */
let speakerDecayTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================
// Types
// ============================================

export interface RoomActions {
  leaveRoom: () => void;
  stopAudio: () => void;
  consumeProducer: (producerId: string, roomId: string, producerUserId?: number, source?: ProducerSource) => Promise<void>;
  stopConsumer: (producerId: string) => void;
  acceptInvite: () => Promise<boolean>;
  declineInvite: () => Promise<boolean>;
  startAudio: () => Promise<void>;
}

// ============================================
// Constants: Event Names
// ============================================

/** All room event names that we register listeners for */
const ROOM_EVENT_NAMES = [
  'room:userJoined',
  'room:userLeft',
  'room:closed',
  'room:mode',
  'user:profile_updated',
  'audio:newProducer',
  'audio:producerClosed',
  'speaker:active',
  'seat:updated',
  'seat:cleared',
  'seat:evicted',
  'seat:userMuted',
  'seat:locked',
  'seat:invite:received',
  'seat:reaction',
  'chat:message',
  'gift:received',
  'gift:batch',
  'gift:error',
  'gift:prepare',
  'lucky:result',
] as const;

// ============================================
// Cleanup Function
// ============================================

/**
 * Remove all room event listeners from socket.
 * Call this before re-registering listeners to prevent duplicates.
 */
export function cleanupRoomEventHandlers(socket: AudioSocket): void {

  for (const eventName of ROOM_EVENT_NAMES) {
    socket.off(eventName);
  }

  if (speakerDecayTimer) {
    clearTimeout(speakerDecayTimer);
    speakerDecayTimer = null;
  }

  cleanupLuckyEventHandlers(socket);
}

// ============================================
// Setup Function
// ============================================

/**
 * Setup all socket event listeners for room events.
 * Call this after joining a room.
 */
export function setupRoomEventHandlers(
  socket: AudioSocket,
  { leaveRoom, stopAudio, consumeProducer, stopConsumer, acceptInvite, declineInvite, startAudio }: RoomActions,
  toast: ReturnType<typeof useToast>,
): void {

  // Resolve Pinia stores here — safe outside Vue setup context
  const roomStore = useRoomStore();
  const roomSessionStore = useRoomSessionStore();
  const roomSession = useRoomSession();
  const audioStore = useRoomAudioStore();
  const participantsStore = useRoomParticipantsStore();
  const seatsStore = useRoomSeatsStore();
  const authStore = useAuthStore();
  const giftStore = useGiftStore();
  const capabilitiesStore = useServerCapabilitiesStore();

  // Throttle for the ackBalance "gift refunded" toast (ticket 13) — separate
  // timer from the legacy burst-rejection cooldown; scoped to this room
  // session like the other per-call state above.
  let lastRefundToastAt = 0;

  // Pre-resolve composables once (avoids calling inject() inside socket callbacks)
  const { getGiftById } = useGiftData();
  const { triggerFly } = useLuckyFly();
  const { accumulateGiftXp } = useRoomXpAccumulator();
  const { resolvePropAsync } = usePropLookup();
  const { playEntrySlide } = useSlidePlayback();
  const comboStore = useGiftComboStore();

  // Room events
  socket.on('room:userJoined', async (event: UserJoinedEvent) => {
    // realtime-22: capture presence BEFORE the upsert. A seat-retention reclaim
    // re-broadcasts room:userJoined to the whole room; clients that HELD the user
    // through the grace window (their seat + participant were retained) already
    // have them, so replaying the entry animation/slide would be a spurious FX
    // burst for a user who never visibly left. Only fire entry FX for a genuinely
    // new arrival (absent here) — which correctly still fires for late joiners who
    // joined during the grace window and are seeing the user for the first time.
    const wasAlreadyPresent = participantsStore.participants.has(event.user.id);
    participantsStore.addParticipant(event.user);

    if (event.user.entry_animation_id && !roomStore.isMinimized && !wasAlreadyPresent) {
      const prop = await resolvePropAsync(event.user.entry_animation_id);
      if (prop) {
        const giftForPlayback = propToEntryAnimationGift(prop);
        // REACT: start the asset download the moment we learn the animation,
        // not when the modal mounts. Fire-and-forget — never await a ~7MB
        // download here, or it stalls the handler. Deduped with the VAP plugin.
        void giftAssetCache.preloadGift(giftForPlayback, resolveSvgaPlugin());
        giftStore.enqueuePlayback({
          gift: giftForPlayback,
          senderId: event.user.id,
          senderName: event.user.name,
          senderAvatar: event.user.avatar ?? undefined,
          recipientIds: [],
          quantity: 1,
          isEntryAnimation: true,
        });
      }
    }

    // Entry slide overlay — the joiner's equipped slides prop, resolved locally
    // and admitted into the one slide engine (collision-band queue), so
    // simultaneous joins no longer overlap. Runs alongside (not instead of) the
    // entry animation; the two are independent layers. See ADR 0009.
    if (event.user.slides_id && !roomStore.isMinimized && !wasAlreadyPresent) {
      const slideProp = await resolvePropAsync(event.user.slides_id);
      if (slideProp?.slide) {
        playEntrySlide(slideProp.slide, {
          userId: event.user.id,
          userName: event.user.name,
          userAvatar: event.user.avatar ?? null,
          roomName: roomStore.currentRoom?.name ?? '',
        });
      }
    }
  });

  socket.on('room:userLeft', (event: UserLeftEvent) => {
    participantsStore.removeParticipant(event.userId);
    seatsStore.clearParticipantFromSeat(event.userId);
    giftStore.removeRecipient(event.userId);
  });

  socket.on('room:closed', (event: RoomClosedEvent) => {
    toast.add({
      title: 'Room closed',
      description: `The room has been closed: ${event.reason}`,
      color: 'warning',
    });
    leaveRoom();
    // Clear currentRoom so re-opening the SAME room later is a real transition
    // (Watcher 1 only joins when the room id changes). Without this, currentRoom
    // stays set and a return to the same room never re-emits room:join.
    roomSession.leaveRoom();
    const target = roomSessionStore.previousRoute && !roomSessionStore.previousRoute.startsWith('/room/') ? roomSessionStore.previousRoute : '/';
    navigateTo(target, { replace: true });
  });

  // Mode flip — MSAB moved the Room between the interactive and broadcast tiers
  // at the Listener threshold (realtime-08/09). Record BOTH the new mode and the
  // HLS playback URL: useRoomAudio's transport watch keys off both, so carrying
  // the URL here is what lets a Listener ALREADY in the Room switch to HLS the
  // instant it flips (the HTTP resource only delivers the URL to new joiners).
  socket.on('room:mode', (event: RoomModeChangedEvent) => {
    if (event.roomId !== String(roomStore.currentRoom?.id)) return;
    roomStore.refreshCurrentRoom({ mode: event.mode, hls_playback_url: event.hlsPlaybackUrl });
    log.info('Room mode changed', {
      mode: event.mode,
      transition: event.transition,
      listenerCount: event.listenerCount,
    });
  });

  // Block/kick (unified, ADR 0017) — admin/owner blocked+removed the current
  // user from the room. Toast + membership-store cleanup is handled by
  // room-membership.events.ts (room.member_removed, registered once globally);
  // this listener owns the ejection side-effects (leave room, navigate away)
  // that require RoomActions. NOT added to ROOM_EVENT_NAMES/cleanupRoomEventHandlers
  // — that array does a blanket socket.off(eventName) which would also strip the
  // global membership listener sharing this event name. Instead we off/on our own
  // named handler each setup call to avoid accumulating duplicate listeners.
  socket.off('room.member_removed', handleMemberRemovedEjection);
  socket.on('room.member_removed', handleMemberRemovedEjection);

  function handleMemberRemovedEjection(event: { room_id: number; user_id: number }): void {
    if (authStore.user?.id !== event.user_id) return;
    if (String(event.room_id) !== roomStore.currentRoom?.id?.toString()) return;

    leaveRoom();
    // Clear currentRoom (see room:closed) — otherwise a kicked user returning to
    // the SAME room never re-joins (currentRoom unchanged → Watcher 1 no-ops),
    // leaving audio stuck on "loading". A different room worked because its id
    // changed. roomSession.leaveRoom() also re-triggers the lifecycle teardown.
    roomSession.leaveRoom();
    const target = roomSessionStore.previousRoute && !roomSessionStore.previousRoute.startsWith('/room/') ? roomSessionStore.previousRoute : '/';
    navigateTo(target, { replace: true });
  }

  // Profile sync — keeps participant data fresh when MSAB broadcasts a profile change.
  // Private balance fields (coins, diamonds) are stripped — they are not stored in
  // participantsStore and must never leak to other participants.
  // XP fields (wealth_xp, charm_xp) pass through — they come from the
  // balance.updated → user:profileSync path and represent public participant data.

  socket.on('user:profile_updated', (event: { user_id: number; profile: Partial<RoomParticipant> }) => {
    // Strip private balance fields only — XP is public participant data
    const { coins: _c, diamonds: _d, ...safeProfile } = event.profile as Record<string, unknown>;

    participantsStore.updateParticipantProfile(event.user_id, safeProfile as Partial<RoomParticipant>);
    // seatsWithUsers computed reflects the update automatically — no sync call needed.
    if (roomStore.currentRoom?.owner?.id === event.user_id) {
      roomStore.refreshCurrentRoom({
        owner: { ...roomStore.currentRoom.owner, ...safeProfile },
      });
    }

    // Also patch local user if the update is for the authenticated user
    if (event.user_id === authStore.user?.id) {
      authStore.patchProfile(safeProfile);
    }

    // undefined
  });

  // Audio events
  socket.on('audio:newProducer', async (event: NewProducerEvent) => {
    // Compat: a producer announced without `source` (pre-feature server/peer)
    // is treated as `mic`.
    if (roomStore.currentRoom) {
      try {
        await consumeProducer(event.producerId, roomStore.currentRoom.id.toString(), event.userId, event.source ?? 'mic');
      } catch (err) {
        // Timeout/disconnect mid-consume is expected network churn: the
        // reconnect pipeline rebuilds transports and re-consumes every live
        // producer, so log and lean on that self-heal instead of surfacing
        // an unhandled rejection.
        log.warn('Failed to consume announced producer', { producerId: event.producerId, err });
      }
    }
  });

  socket.on('audio:producerClosed', (event: ProducerClosedEvent) => {
    stopConsumer(event.producerId);
  });

  socket.on('speaker:active', (event: ActiveSpeakerEvent) => {
    const ids = event.activeSpeakers
      ? event.activeSpeakers.map((id) => parseInt(id))
      : [parseInt(event.userId)];

    audioStore.setActiveSpeakers(ids);
    seatsStore.syncActiveSpeakers(ids);

    // Decay: clear indicators if no fresh speaker:active arrives in time.
    if (speakerDecayTimer) clearTimeout(speakerDecayTimer);
    speakerDecayTimer = setTimeout(() => {
      speakerDecayTimer = null;
      audioStore.setActiveSpeakers([]);
      seatsStore.syncActiveSpeakers([]);
    }, SPEAKER_ACTIVE_TTL_MS);
  });

  socket.on('seat:updated', (event: SeatUpdatedEvent) => {
    seatsStore.updateSeat(event.seatIndex, event.userId, event.isMuted);
  });

  socket.on('seat:cleared', (event: SeatClearedEvent) => {
    const seat = seatsStore.seats[event.seatIndex];

    // Ignore stale delayed clears. MSAB now includes the user being cleared;
    // if the seat has since been reused or rehydrated with another user, this
    // event must not evict the current occupant.
    if (event.userId !== undefined && seat?.occupantId !== event.userId) {
      return;
    }

    const wasCurrentUserSeated = seat?.occupantId === authStore.user?.id;

    seatsStore.clearSeat(event.seatIndex);

    // room-seat-caps/02: shrink evictions carry their own teardown + toast via
    // the targeted `seat:evicted` handler below — skip the generic message
    // here so the displaced user doesn't see two toasts.
    if (wasCurrentUserSeated && event.reason !== 'shrink') {
      stopAudio();

      // Only a forced removal (owner/admin `seat:remove`, tagged "removed" by
      // MSAB) warrants a toast — voluntary self-leave and grace sweeps stay
      // silent.
      if (event.reason === 'removed') {
        toast.add({
          title: 'Removed from seat',
          description: 'You have been removed from your seat',
          color: 'warning',
        });
      }
    }
  });

  // room-seat-caps/02: Seat Eviction (shrink) — targeted, only the displaced
  // user receives this. Local speaker-state teardown mirrors the seat:cleared
  // own-seat path (stopAudio); the room-wide seat:cleared (reason: "shrink")
  // already cleared the seat in the store for everyone, including this user.
  socket.on('seat:evicted', (_event: SeatEvictedEvent) => {
    stopAudio();
    toast.add({
      title: 'Seat count reduced',
      description: "The room seat count was reduced — you've been moved to the audience",
      color: 'warning',
    });
  });

  socket.on('seat:userMuted', (event: SeatUserMutedEvent) => {
    seatsStore.setSeatMutedByUserId(event.userId, event.isMuted);
  });

  socket.on('seat:locked', (event: SeatLockedEvent) => {
    seatsStore.setSeatLocked(event.seatIndex, event.isLocked);
    // A locked seat is empty by definition (locking kicks any occupant). If the
    // kick's `seat:cleared` was missed/dropped on this client, force-clear the
    // occupant here so the locked-seat visual — which only renders on an EMPTY
    // seat — shows for everyone, including the owner who issued the lock.
    if (event.isLocked) {
      const seat = seatsStore.seats[event.seatIndex];
      if (seat?.occupantId != null) {
        seatsStore.clearSeat(event.seatIndex);
      }
    }
  });

  // Seat Reactions (ADR 0015) — store setter only, no business logic here
  socket.on('seat:reaction', (event: SeatReactionEvent) => {
    seatsStore.setReaction(event.userId, event.code);
  });

  // Invite events
  socket.on('seat:invite:received', (event: SeatInviteReceivedEvent) => {
    // Only show toast if this invite is for the current user
    if (event.targetUserId === authStore.user?.id) {
      const inviter = participantsStore.participants.get(event.invitedById);
      const inviterName = inviter?.name ?? 'Someone';

      toast.add({
        id: `seat-invite-${event.seatIndex}`,
        title: 'Seat Invitation',
        description: `${inviterName} invited you to Seat ${event.seatIndex + 1}`,
        color: 'primary',
        duration: 30000,
        actions: [
          {
            label: 'Accept',
            color: 'primary',
            // Nothing awaits a toast action, so an async handler's rejection
            // escapes as an unhandled rejection — which is how a dismissed mic
            // prompt reached Sentry (JAVASCRIPT-VUE-5V). Terminate the chain here.
            onClick: () => void acceptSeatInvite(),
          },
          {
            label: 'Decline',
            color: 'neutral',
            // `void` discards the promise but does NOT catch it — same trap.
            onClick: () => void declineInvite().catch((err: unknown) => {
              log.warn('Failed to decline seat invite', err);
            }),
          },
        ],
      });
    }
  });

  // Chat events
  socket.on('chat:message', (event: ChatMessageEvent) => {
    audioStore.addMessage(event);
  });

  // Gift events. Burst-shaped events carry `recipientIds[]`; legacy
  // un-upgraded MSAB (or the N legacy singular siblings of a burst) carry the
  // singular `recipientId`. Normalize to an array up front.
  socket.on('gift:received', (event: GiftReceivedEvent) => {
    // GATE (gift-authority-tick-fanout ticket 15): once this connection's
    // `server:capabilities` says `giftBatch` is true, `gift:batch` is the
    // SOLE source of truth for gift XP/chat/playback/lucky taps on this
    // client. During rollout a server may send BOTH shapes for the same taps
    // (`GIFT_LEGACY_SHAPE` on together with the tick) — legacy carries no
    // transaction id to dedupe against, so the deterministic, double-count-free
    // choice is to stop processing legacy entirely the moment the capability
    // is known. See `seenGiftBatchTxIds` above for the full de-dup writeup.
    if (capabilitiesStore.giftBatch) return;

    const recipientIds = event.recipientIds ?? [event.recipientId];
    const batchId = event.batchId;
    // Legs of this batch not yet processed — dedupes the burst-shaped event
    // against its N legacy singular siblings for BOTH the XP/seat accumulation
    // below and the lucky fly animations (which would otherwise double-fire).
    const newLegs = batchId
      ? recipientIds.filter((recipientId) => !hasSeenGiftLeg(batchId, recipientId))
      : recipientIds;
    const giftForValue = getGiftById(event.giftId);

    // Accumulate gift coin value, once per (batchId, recipient) leg. The four
    // store writes (room XP, daily XP, period total, seat total) are folded
    // into one flush per frame by useRoomXpAccumulator — a lucky combo lands
    // hundreds of legs per second and each write re-rendered the header.
    if (giftForValue && roomStore.currentRoom) {
      for (const recipientId of newLegs) {
        // Seat total and room XP both credit the split base the backend books
        // (normal → full GCV, lucky → floor(GCV × LUCKY_SPLIT_SHARE)); seatGiftValue
        // returns exactly that. Must match the sender's optimistic bump in
        // useRoomGifts.sendGift or the two clients' room XP drift apart on lucky sends.
        accumulateGiftXp(recipientId, seatGiftValue(giftForValue, event.quantity));
      }
    }

    // Chat gift-announcement bubble (lucky-burst-draw ticket 10) — synthesized
    // for EVERY OTHER client in the room (the sender's own bubble is
    // synthesized locally by `announceLocalGiftSend` — MSAB excludes the
    // sender from this broadcast), so runs before the sender/minimized early
    // returns below (those only gate the fly/playback FX). Only the burst
    // shape (recipientIds present) synthesizes — the N legacy singular
    // siblings sharing the same batchId describe the SAME legs and must never
    // double-announce. Lucky-category gifts never get a gift-sent bubble —
    // they announce only via the lucky-win slide bubble (HITL 2026-07-23).
    // Current-room gate: `gift:received` is only wired while this room's
    // socket is joined, so no extra roomId check is needed here (unlike the
    // global membership listeners).
    if (event.recipientIds && giftForValue && !isLuckyCategory(giftForValue.category)) {
      synthesizeGiftChatMessage(audioStore, participantsStore, event, giftForValue, event.recipientIds);
    }

    // Skip if current user is the sender
    if (event.senderId === authStore.user?.id) return;

    // Skip if room is minimized
    if (roomStore.isMinimized) return;

    // Look up sender from participants store
    const sender = participantsStore.participants.get(event.senderId);

    const gift = getGiftById(event.giftId);

    if (gift) {
      if (isLuckyCategory(gift.category)) {
        // Sender activity band tap (lucky-animation-ux epic) — burst shape
        // only, so the N legacy singular siblings of the same batch never
        // double-count the xN counter (same gate as the chat synthesis above).
        if (event.recipientIds) {
          recordLuckyGiftTap({
            senderId: event.senderId,
            senderName: sender?.name ?? 'Someone',
            senderAvatar: sender?.avatar ?? null,
            giftName: gift.label ?? gift.name,
            recipientIds: event.recipientIds,
            quantity: event.quantity,
          });
        }

        // Only un-seen legs fly — the burst-shaped event and its legacy
        // singular siblings describe the same legs.
        for (const recipientId of newLegs) {
          triggerFly(gift.thumbnail_url, event.senderId, recipientId);
        }
        return;
      }

      // Pass batchId so the queue coalesces this send's per-recipient fan-out
      // (burst-shaped + legacy singular siblings) into one playback. Distinct
      // send/combo presses carry distinct batchIds, so genuine combos still
      // enqueue separately and play one after another — nothing ever
      // interrupts the gift currently on screen.
      giftStore.enqueuePlayback({
        gift,
        senderId: event.senderId,
        senderName: sender?.name ?? 'Unknown',
        senderAvatar: sender?.avatar ?? undefined,
        recipientIds,
        quantity: event.quantity,
        batchId: event.batchId,
      });
    }
  });

  // `gift:batch` — one merged tick (gift-authority-tick-fanout ticket 14/15).
  // Sent to the WHOLE room, including the sender. Processed in one pass per
  // item: XP accumulated once per item (value × count), one chat bubble per
  // item, one playback enqueue per item (quantity × count folded into the
  // repeat counter), one lucky-fly request per item (carrying count), one
  // lucky tap-activity record per item, and the tick's `lucky[]` entries fold
  // through the existing `lucky:room-result` handler.
  socket.on('gift:batch', (event: GiftBatchEvent) => {
    for (const item of event.items) {
      // Safety-net de-dup only — see `seenGiftBatchTxIds` for why this is not
      // the primary legacy/batch overlap guard (that's the capability gate on
      // `gift:received` above). Skips a whole-tick re-delivery (reconnect
      // replay); the server's own merge key already guarantees one item per
      // (sender, gift, recipient set) within a single tick.
      if (markGiftBatchTxIdsSeen(item.transactionIds)) continue;

      const gift = getGiftById(item.giftId);
      if (!gift) continue;

      // The sender's own client already booked this tap's XP/chat/playback/fly
      // optimistically at send time (useRoomGifts.sendGift / useGiftSending).
      // Unlike legacy `gift:received` (which MSAB never sends to the sender),
      // `gift:batch` is room-wide INCLUDING the sender — so the sender's own
      // items must be skipped here entirely (XP included), or every one of
      // those effects double-books on the sender's own screen.
      if (item.senderId === authStore.user?.id) continue;

      // XP accumulated once per item (value × count).
      if (roomStore.currentRoom) {
        const perRecipientXp = seatGiftValue(gift, item.quantity) * item.count;
        for (const recipientId of item.recipientIds) {
          accumulateGiftXp(recipientId, perRecipientXp);
        }
      }

      // One chat bubble per item — fold count into the announced quantity so
      // a merged tick still shows the true total, same as N legacy events
      // patching the same streak bubble in place would have summed to.
      if (!isLuckyCategory(gift.category)) {
        synthesizeGiftChatMessage(
          audioStore,
          participantsStore,
          { senderId: item.senderId, giftId: item.giftId, quantity: item.quantity * item.count },
          gift,
          item.recipientIds,
        );
      }

      if (roomStore.isMinimized) continue;

      const sender = participantsStore.participants.get(item.senderId);

      if (isLuckyCategory(gift.category)) {
        // One lucky tap-activity record per item — count already folds into
        // the accumulated xN (see recordLuckyGiftTap's `count` param).
        recordLuckyGiftTap({
          senderId: item.senderId,
          senderName: sender?.name ?? 'Someone',
          senderAvatar: sender?.avatar ?? null,
          giftName: gift.label ?? gift.name,
          recipientIds: item.recipientIds,
          quantity: item.quantity,
          count: item.count,
        });

        // One lucky-fly request per item per recipient, carrying `count` —
        // the renderer streams the flies with its existing pacing, nothing
        // capped or dropped.
        for (const recipientId of item.recipientIds) {
          triggerFly(gift.thumbnail_url, item.senderId, recipientId, item.count);
        }
        continue;
      }

      // One playback enqueue per item — `count` (merged taps) folded into the
      // existing repeat counter: legacy coalesces one repeat per EVENT (tap)
      // regardless of quantity, so a batch item = `count` repeats, clamped to
      // the same MAX_PLAYBACK_REPEATS the legacy coalescer stops at.
      giftStore.enqueuePlayback({
        gift,
        senderId: item.senderId,
        senderName: sender?.name ?? 'Unknown',
        senderAvatar: sender?.avatar ?? undefined,
        recipientIds: item.recipientIds,
        quantity: item.quantity,
        repeats: Math.min(item.count, MAX_PLAYBACK_REPEATS),
      });
    }

    // Lucky room-win results ride the same tick — fold each through the
    // SAME handler `lucky:result`/`lucky:room-result` uses today, so band
    // accumulation + chat bubble stay byte-identical; only the store writes
    // are frame-coalesced (see useLuckyGift.flushLuckyGiftWrites).
    for (const luckyEntry of event.lucky) {
      handleLuckyRoomResult(luckyEntry);
    }
  });

  socket.on('gift:error', (event: GiftErrorEvent) => {
    // ackBalance (ticket 13): the batch was already accepted — nothing was
    // optimistically debited, so there is nothing to add back here. The
    // refund itself arrives via `balance.updated` (sequence-guarded); this
    // only announces it, throttled the same way the legacy refund-toast
    // never was (a burst of these previously stayed silent by design).
    if (capabilitiesStore.ackBalance) {
      const now = Date.now();
      if (now - lastRefundToastAt >= GIFT_REFUND_TOAST_COOLDOWN_MS) {
        lastRefundToastAt = now;
        toast.add({
          title: 'Gift refunded',
          description: GIFT_REFUND_TOAST_MESSAGE,
          color: 'warning',
        });
      }
      return;
    }

    // Legacy path — rollback the optimistic coin deduction tracked for THIS
    // batch. A send without a batchId (shouldn't happen post-burst-migration)
    // has nothing to key the refund on, so it's skipped rather than guessing.
    if (event.batchId) {
      const refundAmount = comboStore.consumePendingRefund(event.batchId);
      if (refundAmount > 0) {
        const currentCoins = Number(authStore.user?.coins ?? 0);
        authStore.patchBalance({ coins: String(currentCoins + refundAmount) });
      }
    }

    // MSAB sends { code, reason }; normalize for display
    const errorCode = String(event.code ?? event.error ?? '');
    const errorMessage = event.reason ?? event.message;

    if (errorCode === '4002' || errorCode === 'insufficient_balance') {
      toast.add({
        title: 'Insufficient balance',
        description: 'Please top up your coins to send gifts.',
        color: 'error',
      });
    } else {
      toast.add({
        title: 'Gift failed',
        description: errorMessage || 'Failed to send gift. Please try again.',
        color: 'error',
      });
    }
  });

  // Gift preload signal (receiver should preload asset)
  socket.on('gift:prepare', async (event: GiftPrepareEvent) => {
    // Only preload if this user is the intended recipient
    if (event.recipientId !== authStore.user?.id) return;
    const gift = getGiftById(event.giftId);
    if (gift) {
      await giftAssetCache.preloadGift(gift, resolveSvgaPlugin());
    }
  });

  // Lucky gift event handlers (floating multipliers, SVGA announcements)
  setupLuckyEventHandlers(socket);

  /**
   * REACT: accept a seat invite and open the mic, converting every failure into
   * user feedback. Taking the seat runs the browser's permission prompt, and a
   * dismissed prompt rejects with `NotAllowedError` — expected user behaviour,
   * not an app fault, so it gets the same guidance as the seat drawer's own
   * denial path rather than a silent failure.
   */
  async function acceptSeatInvite(): Promise<void> {
    try {
      await acceptInvite();
      await startAudio();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        toast.add({
          title: 'Microphone blocked',
          description: 'Enable microphone access for FlyLive in your device settings to speak on a seat.',
          color: 'warning',
        });
        return;
      }
      log.warn('Failed to accept seat invite', err);
      toast.add({
        title: 'Could not take the seat',
        description: 'Something went wrong accepting the invitation. Please try again.',
        color: 'error',
      });
    }
  }
}
