import type {
  JoinRoomResponse,
  UserJoinedEvent,
  UserLeftEvent,
  RoomClosedEvent,
  NewProducerEvent,
  ChatMessageEvent,
  GiftReceivedEvent,
  GiftErrorEvent,
  ActiveSpeakerEvent,
  SeatUpdatedEvent,
  SeatClearedEvent,
  SeatUserMutedEvent,
  SeatResponse,
} from '~/types/audio';
import { userToParticipant } from '~/types/audio';
import type { AudioSocket } from './useAudioSocket';

// ============================================
// Types
// ============================================

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
  /** Send chat message */
  sendChatMessage: (content: string, type?: string) => void;
  /** Send gift */
  sendGift: (giftId: number, recipientId: number, quantity?: number) => void;
  /** Connection status */
  connectionStatus: Ref<'disconnected' | 'connecting' | 'connected' | 'error'>;
  /** Whether connected to audio server */
  isConnected: ComputedRef<boolean>;
  /** Whether producing audio */
  isProducing: ComputedRef<boolean>;
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
      socket.value.emit(event, payload, (response: TResponse) => {
        resolve(response);
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
      roomStore.clearSeat(event.seatIndex);
    });

    s.on('seat:userMuted', (event: SeatUserMutedEvent) => {
      roomStore.setParticipantMuted(event.userId, event.isMuted);
    });

    // Chat events
    s.on('chat:message', (event: ChatMessageEvent) => {
      roomStore.addMessage(event);
    });

    // Gift events
    s.on('gift:received', (event: GiftReceivedEvent) => {
      roomStore.handleGiftReceived(event);
    });

    s.on('gift:error', (event: GiftErrorEvent) => {
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

    // Join room via socket
    const response = await emitAsync<{ roomId: string }, JoinRoomResponse>('room:join', { roomId });

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
    if (response.seats && response.seats.length > 0) {
      console.log('[RoomAudio] Initializing', response.seats.length, 'seats');
      for (const seat of response.seats) {
        // Find the participant to get full user info
        const userId = parseInt(seat.userId, 10);
        const participant = roomStore.participants.get(userId);
        if (participant) {
          roomStore.updateSeat(seat.seatIndex, participant, seat.isMuted);
        }
      }
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

    return response.success ?? false;
  }

  /**
   * Leave current seat.
   */
  async function leaveSeat(): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:leave', {
      roomId: roomStore.currentRoom.id.toString(),
    });

    if (response.error) {
      toast.add({ title: 'Cannot leave seat', description: response.error, color: 'error' });
      return false;
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
   */
  function sendGift(giftId: number, recipientId: number, quantity: number = 1): void {
    if (!socket.value || !roomStore.currentRoom) return;

    socket.value.emit('gift:send', {
      roomId: roomStore.currentRoom.id.toString(),
      giftId,
      recipientId,
      quantity,
    });
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
    sendChatMessage,
    sendGift,
    connectionStatus,
    isConnected,
    isProducing,
  };
}
