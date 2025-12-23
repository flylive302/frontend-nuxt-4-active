import type {
  JoinRoomResponse,
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
  SeatResponse,
} from '~/types/audio';
import { userToParticipant } from '~/types/audio';
import { GIFT_QUEUE_INTERVAL_MS } from '../constants/gift';
import type { AudioSocket } from './useAudioSocket';

// ============================================
// Types
// ============================================

/** Data required for an outgoing gift socket message */
interface QueuedGift {
  roomId: string;
  giftId: number;
  recipientId: number;
  quantity: number;
}

export interface UseRoomAudioReturn {
  /** Join a room with audio capabilities */
  joinRoom: (roomId: string) => Promise<void>;
  /** Leave the current room */
  leaveRoom: () => void;
  /** Start producing audio (take a seat first) */
  startAudio: () => Promise<void>;
  /** Stop producing audio */
  stopAudio: () => void;
  /** Take an available seat */
  takeSeat: (seatIndex: number) => Promise<boolean>;
  /** Leave current seat */
  leaveSeat: () => Promise<boolean>;
  /** Owner: Assign user to seat */
  assignUserToSeat: (userId: number, seatIndex: number) => Promise<boolean>;
  /** Owner: Remove user from seat */
  removeUserFromSeat: (userId: number) => Promise<boolean>;
  /** Owner: Mute user */
  muteUser: (userId: number) => Promise<boolean>;
  /** Owner: Unmute user */
  unmuteUser: (userId: number) => Promise<boolean>;
  /** Owner: Lock a seat */
  lockSeat: (seatIndex: number) => Promise<boolean>;
  /** Owner: Unlock a seat */
  unlockSeat: (seatIndex: number) => Promise<boolean>;
  /** Owner: Invite user to a seat */
  inviteToSeat: (userId: number, seatIndex: number) => Promise<boolean>;
  /** Accept pending invite */
  acceptInvite: () => Promise<boolean>;
  /** Decline pending invite */
  declineInvite: () => Promise<boolean>;
  /** Send chat message */
  sendChatMessage: (content: string, type?: string) => void;
  /** Send gift */
  sendGift: (giftId: number, recipientId: number, quantity?: number) => void;
  /** Send gift preload signal to recipients */
  prepareGift: (giftId: number, recipientIds: number[]) => void;
  /** Connection status */
  connectionStatus: Ref<'disconnected' | 'connecting' | 'connected' | 'error'>;
  /** Whether connected to audio server */
  isConnected: ComputedRef<boolean>;
  /** Whether producing audio */
  isProducing: ComputedRef<boolean>;
  /** Whether local microphone is muted */
  isLocalMuted: Ref<boolean>;
  /** Toggle local microphone mute */
  toggleLocalMute: () => boolean;
}

// ============================================
// Shared State (Module-level)
// ============================================

/** Outgoing gift queue to handle rapid combo sends */
const giftQueue: QueuedGift[] = [];
/** Whether the gift queue is currently being processed */
const isProcessingGiftQueue = ref(false);

/**
 * Process the outgoing gift queue sequentially with spacing.
 * This ensures we don't hit server-side rate limits while maintaining
 * smooth optimistic updates on the sender's side.
 */
function processGiftQueue(socket: Ref<AudioSocket | null>) {
  if (isProcessingGiftQueue.value || giftQueue.length === 0) return;

  isProcessingGiftQueue.value = true;

  const processNext = () => {
    // Stop if socket is gone or queue is empty
    if (!socket.value || giftQueue.length === 0) {
      isProcessingGiftQueue.value = false;
      return;
    }

    const gift = giftQueue.shift();
    if (gift) {
      socket.value.emit('gift:send', gift);
    }

    // Schedule next if queue still has items
    if (giftQueue.length > 0) {
      setTimeout(processNext, GIFT_QUEUE_INTERVAL_MS);
    } else {
      isProcessingGiftQueue.value = false;
    }
  };

  processNext();
}

// ============================================
// Composable
// ============================================

/**
 * Main orchestrator composable for room audio functionality.
 * Combines socket connection, mediasoup, and room state management.
 */
export function useRoomAudio(): UseRoomAudioReturn {
  // ========================================
  // Composables / Dependencies
  // ========================================
  const roomStore = useRoomStore();
  const authStore = useAuthStore();
  const giftStore = useGiftStore();
  const toast = useToast();

  // Socket and mediasoup instances
  const { socket, connect, disconnect, status: connectionStatus, isConnected } = useAudioSocket();
  const {
    loadDevice,
    createTransports,
    startAudio: startMediasoupAudio,
    stopAudio: stopMediasoupAudio,
    consumeProducer,
    cleanup: cleanupMediasoup,
    isProducing,
    isLocalMuted,
    toggleLocalMute,
  } = useMediasoup(socket);

  // ========================================
  // Private Helpers
  // ========================================

  /**
   * Emit socket event with promise-based response
   */
  function emitAsync<TPayload, TResponse>(event: string, payload: TPayload): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      if (!socket.value) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      let isResolved = false; // Track if promise was already resolved/rejected
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Socket event ${event} timed out after 10 seconds`));
        }
      }, 10000);
      
      socket.value.emit(event, payload, (response: TResponse) => {
        clearTimeout(timeoutId);
        if (!isResolved) {
          isResolved = true;
          resolve(response);
        }
        // If already resolved/rejected, ignore the callback to prevent memory leaks
      });
    });
  }

  /**
   * Setup all socket event listeners for room events
   */
  function setupEventListeners() {
    if (!socket.value) return;

    const s = socket.value as AudioSocket;

    // Room events
    s.on('room:userJoined', (event: UserJoinedEvent) => {
      roomStore.addParticipant(event.user);
      console.log('[RoomAudio] User joined:', event.user.name);
    });

    s.on('room:userLeft', (event: UserLeftEvent) => {
      roomStore.removeParticipant(event.userId);
      giftStore.removeRecipient(event.userId);
      console.log('[RoomAudio] User left:', event.userId);
    });

    s.on('room:closed', (event: RoomClosedEvent) => {
      toast.add({
        title: 'Room closed',
        description: `The room has been closed: ${event.reason}`,
        color: 'warning',
      });
      leaveRoom();
      navigateTo('/');
    });

    // Audio events
    s.on('audio:newProducer', async (event: NewProducerEvent) => {
      console.log('[RoomAudio] New producer from user:', event.userId);
      if (roomStore.currentRoom) {
        await consumeProducer(event.producerId, roomStore.currentRoom.id.toString());
      }
    });

    s.on('speaker:active', (event: ActiveSpeakerEvent) => {
      roomStore.setActiveSpeaker(parseInt(event.userId));
    });

    // Seat events
    s.on('seat:updated', (event: SeatUpdatedEvent) => {
      roomStore.updateSeat(event.seatIndex, event.user, event.isMuted);
    });

    s.on('seat:cleared', (event: SeatClearedEvent) => {
      // Check if current user was on this seat before clearing
      const seat = roomStore.seats[event.seatIndex];
      const wasCurrentUserSeated = seat?.user?.id === authStore.user?.id;

      roomStore.clearSeat(event.seatIndex);

      // If current user was kicked, stop their audio
      if (wasCurrentUserSeated) {
        console.log('[RoomAudio] User was kicked from seat, stopping audio');
        stopMediasoupAudio();
        toast.add({
          title: 'Removed from seat',
          description: 'You have been removed from your seat',
          color: 'warning',
        });
      }
    });

    s.on('seat:userMuted', (event: SeatUserMutedEvent) => {
      roomStore.setParticipantMuted(event.userId, event.isMuted);
    });

    s.on('seat:locked', (event: SeatLockedEvent) => {
      roomStore.setSeatLocked(event.seatIndex, event.isLocked);
    });

    // Invite events
    s.on('seat:invite:received', (event: SeatInviteReceivedEvent) => {
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
    s.on('chat:message', (event: ChatMessageEvent) => {
      roomStore.addMessage(event);
    });

    // Gift events
    s.on('gift:received', (event: GiftReceivedEvent) => {
      // Skip if current user is the sender (they already see optimistic playback)
      if (event.senderId === authStore.user?.id) return;

      // Get gift data to enqueue playback
      const { getGiftById } = useGiftData();
      const gift = getGiftById(event.giftId);
      
      if (gift) {
        // Check if this is a combo (same gift+sender as current playback)
        const current = giftStore.currentPlayback;
        const isCombo = current &&
          current.gift.id === gift.id &&
          current.senderId === event.senderId;

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

    s.on('gift:error', (event: GiftErrorEvent) => {
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
          description: 'Failed to send gift. Please try again.',
          color: 'error',
        });
      }
    });

    // Gift preload signal (receiver should preload asset)
    s.on('gift:prepare', async (event: GiftPrepareEvent) => {
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

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Join a room with audio capabilities.
   * Connects to audio server, joins room, and sets up transports.
   */
  async function joinRoom(roomId: string): Promise<void> {
    // Connect to audio server
    connect();

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      if (isConnected.value) {
        resolve();
        return;
      }

      const unwatch = watch(connectionStatus, (newStatus) => {
        if (newStatus === 'connected') {
          unwatch();
          resolve();
        } else if (newStatus === 'error') {
          unwatch();
          reject(new Error('Failed to connect to audio server'));
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        unwatch();
        reject(new Error('Connection timeout'));
      }, 10000);
    });

    // Setup event listeners
    setupEventListeners();

    // Join room via socket (send owner ID so server can cache it)
    const ownerId = roomStore.currentRoom?.user?.id;
    const response = await emitAsync<{ roomId: string; ownerId?: number }, JoinRoomResponse>(
      'room:join',
      { roomId, ownerId }
    );

    if (response.error || !response.rtpCapabilities) {
      throw new Error(response.error || 'Failed to join room');
    }

    // Load mediasoup device
    await loadDevice(response.rtpCapabilities);

    // Create transports
    await createTransports(roomId);

    // Update store
    roomStore.setAudioConnected(true);

    // Add self to participants
    if (authStore.user) {
      const participant = userToParticipant(authStore.user, { isSpeaker: false });
      roomStore.addParticipant(participant);
    }

    // Handle initial room state from server
    // 1. Add existing participants
    if (response.participants && response.participants.length > 0) {
      console.log('[RoomAudio] Adding', response.participants.length, 'existing participants');
      for (const p of response.participants) {
        roomStore.addParticipant({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          isSpeaker: p.isSpeaker,
        });
      }
    }

    // 2. Initialize seats from server state
    // Initialize empty/locked seats state
    if (response.seats) {
      response.seats.forEach((seat) => {
        roomStore.updateSeat(seat.seatIndex, seat.user, seat.isMuted);
      });
    }

    // Initialize locked seats (if provided by server)
    if (response.lockedSeats) {
      response.lockedSeats.forEach((seatIndex: number) => {
        roomStore.setSeatLocked(seatIndex, true);
      });
    }

    // 3. Consume existing producers (listen to active speakers)
    if (response.existingProducers && response.existingProducers.length > 0) {
      console.log('[RoomAudio] Consuming', response.existingProducers.length, 'existing producers');
      for (const producer of response.existingProducers) {
        try {
          await consumeProducer(producer.producerId, roomId);
        } catch (err) {
          console.warn('[RoomAudio] Failed to consume producer:', producer.producerId, err);
        }
      }
    }

    console.log('[RoomAudio] Joined room:', roomId);
  }

  /**
   * Leave the current room and clean up all resources.
   */
  function leaveRoom(): void {
    if (socket.value && roomStore.currentRoom) {
      socket.value.emit('room:leave', { roomId: roomStore.currentRoom.id.toString() });
    }

    // Cleanup mediasoup
    cleanupMediasoup();

    // Disconnect socket
    disconnect();

    // Clear room state
    roomStore.clearAudioState();

    console.log('[RoomAudio] Left room');
  }

  /**
   * Start producing audio from microphone.
   */
  async function startAudio(): Promise<void> {
    await startMediasoupAudio();
    roomStore.setProducing(true);
  }

  /**
   * Stop producing audio.
   */
  function stopAudio(): void {
    stopMediasoupAudio();
    roomStore.setProducing(false);
  }

  /**
   * Take an available seat.
   */
  async function takeSeat(seatIndex: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; seatIndex: number }, SeatResponse>('seat:take', {
      roomId: roomStore.currentRoom.id.toString(),
      seatIndex,
    });

    if (response.error) {
      toast.add({ title: 'Cannot take seat', description: response.error, color: 'error' });
      return false;
    }

    // Update local seat state for the current user
    // (Socket.IO's socket.to() excludes sender, so we update locally)
    if (response.success && authStore.user) {
      const currentUser = userToParticipant(authStore.user, { isSpeaker: true, seatIndex });
      roomStore.updateSeat(seatIndex, currentUser, false);
    }

    return response.success ?? false;
  }

  /**
   * Leave current seat.
   */
  async function leaveSeat(): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    // Find current user's seat before leaving
    const currentUserSeatIndex = authStore.user
      ? roomStore.seats.findIndex((s) => s.user?.id === authStore.user!.id)
      : -1;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:leave', {
      roomId: roomStore.currentRoom.id.toString(),
    });

    if (response.error) {
      toast.add({ title: 'Cannot leave seat', description: response.error, color: 'error' });
      return false;
    }

    // Clear local seat state
    // (Socket.IO's socket.to() excludes sender, so we update locally)
    if (response.success && currentUserSeatIndex >= 0) {
      roomStore.clearSeat(currentUserSeatIndex);
    }

    stopAudio();
    return response.success ?? false;
  }

  /**
   * Owner: Assign a user to a seat.
   */
  async function assignUserToSeat(userId: number, seatIndex: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; userId: number; seatIndex: number }, SeatResponse>(
      'seat:assign',
      {
        roomId: roomStore.currentRoom.id.toString(),
        userId,
        seatIndex,
      }
    );

    if (response.error) {
      toast.add({ title: 'Cannot assign seat', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Owner: Remove a user from their seat.
   */
  async function removeUserFromSeat(userId: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('seat:remove', {
      roomId: roomStore.currentRoom.id.toString(),
      userId,
    });

    if (response.error) {
      toast.add({ title: 'Cannot remove user', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Owner: Mute a user.
   */
  async function muteUser(userId: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('seat:mute', {
      roomId: roomStore.currentRoom.id.toString(),
      userId,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Unmute a user.
   */
  async function unmuteUser(userId: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('seat:unmute', {
      roomId: roomStore.currentRoom.id.toString(),
      userId,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Lock a seat.
   */
  async function lockSeat(seatIndex: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; seatIndex: number }, SeatResponse>('seat:lock', {
      roomId: roomStore.currentRoom.id.toString(),
      seatIndex,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Unlock a seat.
   */
  async function unlockSeat(seatIndex: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; seatIndex: number }, SeatResponse>('seat:unlock', {
      roomId: roomStore.currentRoom.id.toString(),
      seatIndex,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Invite user to a seat.
   */
  async function inviteToSeat(userId: number, seatIndex: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; userId: number; seatIndex: number }, SeatResponse>(
      'seat:invite',
      {
        roomId: roomStore.currentRoom.id.toString(),
        userId,
        seatIndex,
      }
    );

    if (response.error) {
      toast.add({ title: 'Cannot invite', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Accept pending invite.
   */
  async function acceptInvite(): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:invite:accept', {
      roomId: roomStore.currentRoom.id.toString(),
    });

    if (response.error) {
      toast.add({ title: 'Cannot accept invite', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Decline pending invite.
   */
  async function declineInvite(): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:invite:decline', {
      roomId: roomStore.currentRoom.id.toString(),
    });

    return response.success ?? false;
  }

  /**
   * Send a chat message.
   */
  function sendChatMessage(content: string, type: string = 'text'): void {
    if (!socket.value || !roomStore.currentRoom) return;

    socket.value.emit('chat:message', {
      roomId: roomStore.currentRoom.id.toString(),
      content,
      type,
    });
  }

  /**
   * Send a gift to a user.
   * Pushes to a local queue to be processed with spacing.
   */
  function sendGift(giftId: number, recipientId: number, quantity: number = 1): void {
    if (!socket.value || !roomStore.currentRoom) return;

    // Push to queue for background processing
    giftQueue.push({
      roomId: roomStore.currentRoom.id.toString(),
      giftId,
      recipientId,
      quantity,
    });

    // Trigger queue processor
    processGiftQueue(socket);
  }

  /**
   * Send preload signal to recipients.
   * Call when sender selects a gift and recipients.
   */
  function prepareGift(giftId: number, recipientIds: number[]): void {
    if (!socket.value || !roomStore.currentRoom) return;

    // Send prepare signal for each recipient
    for (const recipientId of recipientIds) {
      socket.value.emit('gift:prepare', {
        roomId: roomStore.currentRoom.id.toString(),
        giftId,
        recipientId,
      });
    }
  }

  // ========================================
  // Return
  // ========================================
  return {
    joinRoom,
    leaveRoom,
    startAudio,
    stopAudio,
    takeSeat,
    leaveSeat,
    assignUserToSeat,
    removeUserFromSeat,
    muteUser,
    unmuteUser,
    lockSeat,
    unlockSeat,
    inviteToSeat,
    acceptInvite,
    declineInvite,
    sendChatMessage,
    sendGift,
    prepareGift,
    connectionStatus,
    isConnected,
    isProducing,
    isLocalMuted,
    toggleLocalMute,
  };
}
