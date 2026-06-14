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
  NewProducerEvent,
  ProducerClosedEvent,
  ChatMessageEvent,
  GiftReceivedEvent,
  GiftErrorEvent,
  GiftPrepareEvent,
  ActiveSpeakerEvent,
  SeatUpdatedEvent,
  SeatClearedEvent,
  SeatUserMutedEvent,
  SeatLockedEvent,
  SeatInviteReceivedEvent,
} from '~/types/room/audio';
import type { AudioSocket } from './useAudioSocket';
import { setupLuckyEventHandlers, cleanupLuckyEventHandlers } from '../lucky/useLuckyGift';
import { useLuckyFly } from '../lucky/useLuckyFly';
import * as giftAssetCache from '~/services/giftAssetCache';
import { propToEntryAnimationGift } from '~/utils/prop';

// ============================================
// Types
// ============================================

export interface RoomActions {
  leaveRoom: () => void;
  stopAudio: () => void;
  consumeProducer: (producerId: string, roomId: string, producerUserId?: number) => Promise<void>;
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
  'room:kicked',
  'user:profile_updated',
  'audio:newProducer',
  'audio:producerClosed',
  'speaker:active',
  'seat:updated',
  'seat:cleared',
  'seat:userMuted',
  'seat:locked',
  'seat:invite:received',
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
  const slideStore = useRoomSlideStore();
  const comboStore = useGiftComboStore();

  // Room events
  socket.on('room:userJoined', async (event: UserJoinedEvent) => {
    participantsStore.addParticipant(event.user);

    if (event.user.entry_animation_id && !roomStore.isMinimized) {
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
        });
      }
    }

    // Slide overlay — non-blocking SVGA broadcast for the joiner's equipped
    // slides prop. Runs alongside (not instead of) the entry animation; the
    // two are independent layers.
    if (event.user.slides_id && !roomStore.isMinimized) {
      const slideProp = await resolvePropAsync(event.user.slides_id);
      if (slideProp) {
        void giftAssetCache.preloadSvga(slideProp.asset_url);
        slideStore.addSlide({
          assetUrl: slideProp.asset_url,
          userId: event.user.id,
          userName: event.user.name,
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

  // Kick — admin/owner removed user from the room
  socket.on('room:kicked', (_event: { roomId: string; reason: string }) => {
    toast.add({
      title: 'Kicked from room',
      description: 'You have been removed from the room by an admin.',
      color: 'error',
      icon: 'i-lucide-log-out',
    });
    leaveRoom();
    // Clear currentRoom (see room:closed) — otherwise a kicked user returning to
    // the SAME room never re-joins (currentRoom unchanged → Watcher 1 no-ops),
    // leaving audio stuck on "loading". A different room worked because its id
    // changed. roomStore.leaveRoom() also re-triggers the lifecycle teardown.
    roomStore.leaveRoom();
    const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/') ? roomStore.previousRoute : '/';
    navigateTo(target, { replace: true });
  });

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
    // undefined
    if (roomStore.currentRoom) {
      await consumeProducer(event.producerId, roomStore.currentRoom.id.toString(), event.userId);
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

    // Self-retake guard (F-24). MSAB's in-process seat-grace timer (F-6) can
    // fire a `seat:cleared` ~15s after a brief disconnect, EVEN IF the same
    // user reconnected within ~1s and retook their own seat. The previous
    // guard above only handles "someone else took the seat" — this branch
    // catches "the same user retook their own seat within the grace window".
    if (event.userId !== undefined) {
      const recent = seatsStore.getRecentClaim(event.seatIndex);
      if (recent && recent.userId === event.userId && Date.now() - recent.at < 10_000) {
        return;
      }
    }

    const wasCurrentUserSeated = seat?.occupantId === authStore.user?.id;

    seatsStore.clearSeat(event.seatIndex);

    if (wasCurrentUserSeated) {
      stopAudio();
      toast.add({
        title: 'Removed from seat',
        description: 'You have been removed from your seat',
        color: 'warning',
      });
    }
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
      // Seat total reflects the receiver's credited share (lucky → 10%), room XP stays full GCV.
      seatsStore.addSeatGiftValue(event.recipientId, seatGiftValue(giftForValue, event.quantity));

      // Update room XP
      if (roomStore.currentRoom) {
        const addedXp = giftForValue.price * event.quantity;
        const currentXp = parseFloat(roomStore.currentRoom.room_xp || '0');

        roomStore.currentRoom.room_xp = (currentXp + addedXp).toString();
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

      const current = giftStore.currentPlayback;
      const isCombo = current && current.gift.id === gift.id && current.senderId === event.senderId;

      if (isCombo) {
        giftStore.restartCurrentPlayback();
      } else {
        giftStore.enqueuePlayback({
          gift,
          senderId: event.senderId,
          senderName: sender?.name ?? 'Unknown',
          senderAvatar: sender?.avatar ?? undefined,
          recipientIds: [event.recipientId],
          quantity: event.quantity,
        });
      }
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
