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
import { refundPendingCoins } from '../gift/useGiftSending';
import { setupLuckyEventHandlers, cleanupLuckyEventHandlers } from '../lucky/useLuckyGift';
import { useLuckyFly } from '../lucky/useLuckyFly';
import * as giftAssetCache from '~/services/giftAssetCache';

// ============================================
// Types
// ============================================

export interface UseRoomEventHandlersParams {
  /** Socket instance */
  socket: AudioSocket;
  /** Core room store */
  roomStore: ReturnType<typeof useRoomStore>;
  /** Audio store (participants, audio state, chat) */
  audioStore: ReturnType<typeof useRoomAudioStore>;
  /** Seats store (seats, gift totals) */
  seatsStore: ReturnType<typeof useRoomSeatsStore>;
  /** Auth store instance */
  authStore: ReturnType<typeof useAuthStore>;
  /** Gift store instance */
  giftStore: ReturnType<typeof useGiftStore>;
  /** Toast instance */
  toast: ReturnType<typeof useToast>;
  /** Leave room callback */
  leaveRoom: () => void;
  /** Stop audio callback */
  stopAudio: () => void;
  /** Consume producer callback */
  consumeProducer: (producerId: string, roomId: string) => Promise<void>;
  /** Accept invite callback */
  acceptInvite: () => Promise<boolean>;
  /** Decline invite callback */
  declineInvite: () => Promise<boolean>;
  /** Start audio callback */
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
  'lucky:room_announcement',
  'lucky:app_announcement',
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
export function setupRoomEventHandlers({
  socket,
  roomStore,
  audioStore,
  seatsStore,
  authStore,
  giftStore,
  toast,
  leaveRoom,
  stopAudio,
  consumeProducer,
  acceptInvite,
  declineInvite,
  startAudio,
}: UseRoomEventHandlersParams): void {

  // Pre-resolve composables once (avoids calling inject() inside socket callbacks)
  const { getGiftById } = useGiftData();
  const { triggerFly } = useLuckyFly();

  // Room events
  socket.on('room:userJoined', (event: UserJoinedEvent) => {
    audioStore.addParticipant(event.user);
  });

  socket.on('room:userLeft', (event: UserLeftEvent) => {
    audioStore.removeParticipant(event.userId);
    giftStore.removeRecipient(event.userId);
  });

  socket.on('room:closed', (event: RoomClosedEvent) => {
    toast.add({
      title: 'Room closed',
      description: `The room has been closed: ${event.reason}`,
      color: 'warning',
    });
    leaveRoom();
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
    const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/') ? roomStore.previousRoute : '/';
    navigateTo(target, { replace: true });
  });

  // Profile sync — keeps participant data fresh when MSAB broadcasts a profile change.
  // Financial fields (coins, diamonds, wealth_xp, charm_xp) are stripped as a safety
  // net — they are handled exclusively by `balance.updated` to avoid data races.

  socket.on('user:profile_updated', (event: { user_id: number; profile: Partial<RoomParticipant> }) => {
    // Strip financial fields to prevent overwriting data from balance.updated
    const { coins: _c, diamonds: _d, wealth_xp: _w, charm_xp: _ch, ...safeProfile } = event.profile as Record<string, unknown>;

    audioStore.updateParticipantProfile(event.user_id, safeProfile);

    // Also patch local user if the update is for the authenticated user
    if (event.user_id === authStore.user?.id) {
      const userStore = useUserStore();
      userStore.patchProfile(safeProfile);
    }

    // log.debug('Profile updated for user:', event.user_id);
  });

  // Audio events
  socket.on('audio:newProducer', async (event: NewProducerEvent) => {
    // log.debug('New producer from user:', event.userId);
    if (roomStore.currentRoom) {
      await consumeProducer(event.producerId, roomStore.currentRoom.id.toString());
    }
  });

  socket.on('speaker:active', (event: ActiveSpeakerEvent) => {
    const ids = event.activeSpeakers
      ? event.activeSpeakers.map((id) => parseInt(id))
      : [parseInt(event.userId)];

    audioStore.setActiveSpeakers(ids);
  });

  socket.on('seat:updated', (event: SeatUpdatedEvent) => {
    seatsStore.updateSeat(event.seatIndex, event.userId, event.isMuted);
  });

  socket.on('seat:cleared', (event: SeatClearedEvent) => {
    const seat = seatsStore.seats[event.seatIndex];
    const wasCurrentUserSeated = seat?.user?.id === authStore.user?.id;

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
    audioStore.setParticipantMuted(event.userId, event.isMuted);
  });

  socket.on('seat:locked', (event: SeatLockedEvent) => {
    seatsStore.setSeatLocked(event.seatIndex, event.isLocked);
  });

  // Invite events
  socket.on('seat:invite:received', (event: SeatInviteReceivedEvent) => {
    // Only show toast if this invite is for the current user
    if (event.targetUserId === authStore.user?.id) {
      const inviter = audioStore.participants.get(event.invitedById);
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
      seatsStore.addSeatGiftValue(event.recipientId, giftForValue.price * event.quantity);
    }

    // Skip if current user is the sender
    if (event.senderId === authStore.user?.id) return;

    // Skip if room is minimized
    if (roomStore.isMinimized) return;

    // Look up sender from audio store participants
    const sender = audioStore.participants.get(event.senderId);

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
    // Rollback coins on error using module-level function (avoids inject() issues)
    refundPendingCoins();

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
