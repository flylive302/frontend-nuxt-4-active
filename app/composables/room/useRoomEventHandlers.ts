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
import { bumpPeriodTotalXp } from './useRoomGiftLeaderboard';
import { setupLuckyEventHandlers, cleanupLuckyEventHandlers } from '../lucky/useLuckyGift';
import { useLuckyFly } from '../lucky/useLuckyFly';
import * as giftAssetCache from '~/services/giftAssetCache';
import { propToEntryAnimationGift } from '~/utils/prop';
import { createLogger } from '~/utils/logger';
import { SPEAKER_ACTIVE_TTL_MS } from '~/constants/room';

const log = createLogger('[RoomEvents]');

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
  const audioStore = useRoomAudioStore();
  const participantsStore = useRoomParticipantsStore();
  const seatsStore = useRoomSeatsStore();
  const authStore = useAuthStore();
  const giftStore = useGiftStore();

  // Pre-resolve composables once (avoids calling inject() inside socket callbacks)
  const { getGiftById } = useGiftData();
  const { triggerFly } = useLuckyFly();
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
        void giftAssetCache.preloadGift(giftForPlayback);
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
    roomStore.leaveRoom();
    const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/') ? roomStore.previousRoute : '/';
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
    // changed. roomStore.leaveRoom() also re-triggers the lifecycle teardown.
    roomStore.leaveRoom();
    const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/') ? roomStore.previousRoute : '/';
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
      await consumeProducer(event.producerId, roomStore.currentRoom.id.toString(), event.userId, event.source ?? 'mic');
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

    // Self-retake guard (F-24). MSAB's retention sweep (realtime-22) can fire
    // a DELAYED `seat:cleared` after a brief disconnect, EVEN IF the same
    // user reconnected and retook their own seat within the grace window.
    // Gated on reason === 'grace': explicit leave/kick clears are never
    // tagged, so a user who takes a seat and legitimately leaves within 10s
    // still clears everywhere (the untagged guard used to swallow that and
    // leave a ghost occupant on other clients).
    if (event.reason === 'grace' && event.userId !== undefined) {
      const recent = seatsStore.getRecentClaim(event.seatIndex);
      if (recent && recent.userId === event.userId && Date.now() - recent.at < 10_000) {
        return;
      }
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
            onClick: async () => {
              await acceptInvite();
              await startAudio();
            },
          },
          {
            label: 'Decline',
            color: 'neutral',
            onClick: () => void declineInvite(),
          },
        ],
      });
    }
  });

  // Chat events
  socket.on('chat:message', (event: ChatMessageEvent) => {
    audioStore.addMessage(event);
  });

  // Gift events
  socket.on('gift:received', (event: GiftReceivedEvent) => {

    // Accumulate gift coin value for seat display
    const giftForValue = getGiftById(event.giftId);
    if (giftForValue) {
      // Seat total and room XP both credit the split base the backend books
      // (normal → full GCV, lucky → floor(GCV × LUCKY_SPLIT_SHARE)); seatGiftValue
      // returns exactly that. Must match the sender's optimistic bump in
      // useRoomGifts.sendGift or the two clients' room XP drift apart on lucky sends.
      seatsStore.addSeatGiftValue(event.recipientId, seatGiftValue(giftForValue, event.quantity));

      // Update room XP
      if (roomStore.currentRoom) {
        const addedXp = seatGiftValue(giftForValue, event.quantity);
        const currentXp = parseFloat(roomStore.currentRoom.room_xp || '0');

        roomStore.currentRoom.room_xp = (currentXp + addedXp).toString();
        // Daily XP (prd-daily-room-xp.md) mirrors the same amount as the
        // sender's optimistic bump in useRoomGifts.sendGift.
        roomStore.bumpDailyXp(addedXp);
        // Drawer's active-tab period total (05-drawer-period-totals.md) — a gift
        // landing now counts toward every period, so this applies unconditionally.
        bumpPeriodTotalXp(addedXp);
      }
    }

    // Skip if current user is the sender
    if (event.senderId === authStore.user?.id) return;

    // Skip if room is minimized
    if (roomStore.isMinimized) return;

    // Look up sender from participants store
    const sender = participantsStore.participants.get(event.senderId);

    const gift = getGiftById(event.giftId);

    if (gift) {
      if (gift.category === 'lucky') {
        triggerFly(gift.thumbnail_url, event.senderId, event.recipientId);
        return;
      }

      // Pass batchId so the queue coalesces this send's per-recipient fan-out
      // into one playback. Distinct send/combo presses carry distinct batchIds,
      // so genuine combos still enqueue separately and play one after another —
      // nothing ever interrupts the gift currently on screen.
      giftStore.enqueuePlayback({
        gift,
        senderId: event.senderId,
        senderName: sender?.name ?? 'Unknown',
        senderAvatar: sender?.avatar ?? undefined,
        recipientIds: [event.recipientId],
        quantity: event.quantity,
        batchId: event.batchId,
      });
    }
  });

  socket.on('gift:error', (event: GiftErrorEvent) => {
    // Rollback optimistic coin deduction on server error
    if (comboStore.pendingRefund > 0) {
      const currentCoins = Number(authStore.user?.coins ?? 0);
      authStore.patchBalance({ coins: String(currentCoins + comboStore.pendingRefund) });
      comboStore.pendingRefund = 0;
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
      await giftAssetCache.preloadGift(gift);
    }
  });

  // Lucky gift event handlers (floating multipliers, SVGA announcements)
  setupLuckyEventHandlers(socket);
}
