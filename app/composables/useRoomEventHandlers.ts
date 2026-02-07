/**
 * Room Event Handlers Composable
 *
 * Handles all socket event listeners for room audio.
 * Extracted from useRoomAudio.ts for modularity.
 */
import type {
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
} from '~/types/audio';
import type { AudioSocket } from './useAudioSocket';
import { refundPendingCoins } from './useGiftSending';
import { createLogger } from '~/utils/logger';

// ============================================
// Types
// ============================================

export interface UseRoomEventHandlersParams {
  /** Socket instance */
  socket: AudioSocket;
  /** Room store instance */
  roomStore: ReturnType<typeof useRoomStore>;
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
] as const;

// ============================================
// Cleanup Function
// ============================================

/**
 * Remove all room event listeners from socket.
 * Call this before re-registering listeners to prevent duplicates.
 */
export function cleanupRoomEventHandlers(socket: AudioSocket): void {
  const log = createLogger('[RoomEvents]');
  log.debug('Cleaning up room event handlers');
  
  for (const eventName of ROOM_EVENT_NAMES) {
    socket.off(eventName);
  }
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
  const log = createLogger('[RoomEvents]');

  // Room events
  socket.on('room:userJoined', (event: UserJoinedEvent) => {
    roomStore.addParticipant(event.user);
    log.debug('User joined:', event.user.name);
  });

  socket.on('room:userLeft', (event: UserLeftEvent) => {
    roomStore.removeParticipant(event.userId);
    giftStore.removeRecipient(event.userId);
    log.debug('User left:', event.userId);
  });

  socket.on('room:closed', (event: RoomClosedEvent) => {
    toast.add({
      title: 'Room closed',
      description: `The room has been closed: ${event.reason}`,
      color: 'warning',
    });
    leaveRoom();
    navigateTo('/');
  });

  // Audio events
  socket.on('audio:newProducer', async (event: NewProducerEvent) => {
    log.debug('New producer from user:', event.userId);
    if (roomStore.currentRoom) {
      await consumeProducer(event.producerId, roomStore.currentRoom.id.toString());
    }
  });

  socket.on('speaker:active', (event: ActiveSpeakerEvent) => {
    roomStore.setActiveSpeaker(parseInt(event.userId));
  });

  // Seat events
  socket.on('seat:updated', (event: SeatUpdatedEvent) => {
    log.debug('seat:updated received:', {
      seatIndex: event.seatIndex,
      userId: event.user?.id,
      userName: event.user?.name,
      avatar: event.user?.avatar,
      country: event.user?.country,
      gender: event.user?.gender,
    });
    roomStore.updateSeat(event.seatIndex, event.user, event.isMuted);
  });

  socket.on('seat:cleared', (event: SeatClearedEvent) => {
    // Check if current user was on this seat before clearing
    const seat = roomStore.seats[event.seatIndex];
    const wasCurrentUserSeated = seat?.user?.id === authStore.user?.id;

    roomStore.clearSeat(event.seatIndex);

    // If current user was kicked, stop their audio
    if (wasCurrentUserSeated) {
      log.debug('User was kicked from seat, stopping audio');
      stopAudio();
      toast.add({
        title: 'Removed from seat',
        description: 'You have been removed from your seat',
        color: 'warning',
      });
    }
  });

  socket.on('seat:userMuted', (event: SeatUserMutedEvent) => {
    roomStore.setParticipantMuted(event.userId, event.isMuted);
  });

  socket.on('seat:locked', (event: SeatLockedEvent) => {
    roomStore.setSeatLocked(event.seatIndex, event.isLocked);
  });

  // Invite events
  socket.on('seat:invite:received', (event: SeatInviteReceivedEvent) => {
    // Only show toast if this invite is for the current user
    if (event.targetUserId === authStore.user?.id) {
      toast.add({
        id: `seat-invite-${event.seatIndex}`,
        title: 'Seat Invitation',
        description: `${event.invitedBy.name} invited you to Seat ${event.seatIndex + 1}`,
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
    roomStore.addMessage(event);
  });

  // Gift events
  socket.on('gift:received', (event: GiftReceivedEvent) => {
    // Skip if current user is the sender (they already see optimistic playback)
    if (event.senderId === authStore.user?.id) return;

    // Get gift data to enqueue playback
    const { getGiftById } = useGiftData();
    const gift = getGiftById(event.giftId);

    if (gift) {
      // Check if this is a combo (same gift+sender as current playback)
      const current = giftStore.currentPlayback;
      const isCombo = current && current.gift.id === gift.id && current.senderId === event.senderId;

      if (isCombo) {
        // Restart current playback instead of enqueuing
        giftStore.restartCurrentPlayback();
      } else {
        giftStore.enqueuePlayback({
          gift,
          senderId: event.senderId,
          senderName: event.senderName,
          senderAvatar: event.senderAvatar,
          recipientIds: [event.recipientId],
          quantity: event.quantity,
        });
      }
    }
  });

  socket.on('gift:error', (event: GiftErrorEvent) => {
    // Rollback coins on error using module-level function (avoids inject() issues)
    refundPendingCoins();

    if (event.error === 'insufficient_balance') {
      toast.add({
        title: 'Insufficient balance',
        description: 'Please top up your coins to send gifts.',
        color: 'error',
      });
    } else {
      toast.add({
        title: 'Gift failed',
        description: event.message || 'Failed to send gift. Please try again.',
        color: 'error',
      });
    }
  });

  // Gift preload signal (receiver should preload asset)
  socket.on('gift:prepare', async (event: GiftPrepareEvent) => {
    // Only preload if this user is the intended recipient
    if (event.recipientId !== authStore.user?.id) return;

    const { getGiftById } = useGiftData();
    const { preloadGift } = useGiftAssetCache();

    const gift = getGiftById(event.giftId);
    if (gift) {
      await preloadGift(gift);
    }
  });
}
