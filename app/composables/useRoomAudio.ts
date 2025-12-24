/**
 * Room Audio Composable - Orchestrator
 *
 * Main orchestrator that combines socket connection, mediasoup, and room state management.
 * Delegates to specialized composables for modularity and extensibility.
 *
 * @see useSeatActions.ts - Seat management operations
 * @see useRoomEventHandlers.ts - Socket event handlers
 * @see useRoomGifts.ts - Gift queue processing
 */
import type { JoinRoomResponse } from '~/types/audio';
import { userToParticipant } from '~/types/audio';
import type { Ref, ComputedRef } from 'vue';
import { setupRoomEventHandlers } from './useRoomEventHandlers';
import { useSeatActions, type UseSeatActionsReturn } from './useSeatActions';
import { useRoomGifts, type UseRoomGiftsReturn } from './useRoomGifts';

// ============================================
// Types
// ============================================

export interface UseRoomAudioReturn extends UseSeatActionsReturn, UseRoomGiftsReturn {
  /** Join a room with audio capabilities */
  joinRoom: (roomId: string) => Promise<void>;
  /** Leave the current room */
  leaveRoom: () => void;
  /** Start producing audio (take a seat first) */
  startAudio: () => Promise<void>;
  /** Stop producing audio */
  stopAudio: () => void;
  /** Send chat message */
  sendChatMessage: (content: string, type?: string) => void;
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
// Composable
// ============================================

/**
 * Main orchestrator composable for room audio functionality.
 * Combines socket connection, mediasoup, and room state management.
 */
export function useRoomAudio(): UseRoomAudioReturn {
  // ========================================
  // Dependencies
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
  // Helper: Get current room ID
  // ========================================
  function getCurrentRoomId(): string | null {
    return roomStore.currentRoom?.id.toString() ?? null;
  }

  // ========================================
  // Helper: Emit with Promise
  // ========================================
  function emitAsync<TPayload, TResponse>(event: string, payload: TPayload): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      if (!socket.value) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Socket event '${event}' timed out`));
      }, 10000);

      socket.value.emit(event, payload, (response: TResponse) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  // ========================================
  // Core Audio Functions
  // ========================================

  /**
   * Stop producing audio.
   */
  function stopAudio(): void {
    stopMediasoupAudio();
    roomStore.setProducing(false);
  }

  /**
   * Start producing audio from microphone.
   */
  async function startAudio(): Promise<void> {
    await startMediasoupAudio();
    roomStore.setProducing(true);
  }

  // ========================================
  // Sub-Composables (Delegated Logic)
  // ========================================

  // Seat actions (take, leave, assign, mute, lock, invite)
  const seatActions = useSeatActions({
    emitAsync,
    getCurrentRoomId,
    roomStore,
    authStore,
    toast,
    stopAudio,
  });

  // Gift queue (send, prepare)
  const giftActions = useRoomGifts({
    socket,
    getCurrentRoomId,
  });

  // ========================================
  // Room Lifecycle
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

    // Setup event listeners (delegated to useRoomEventHandlers)
    if (socket.value) {
      setupRoomEventHandlers({
        socket: socket.value,
        roomStore,
        authStore,
        giftStore,
        toast,
        leaveRoom,
        stopAudio,
        consumeProducer,
        acceptInvite: seatActions.acceptInvite,
        declineInvite: seatActions.declineInvite,
        startAudio,
      });
    }

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

  // ========================================
  // Chat
  // ========================================

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

  // ========================================
  // Return Combined API
  // ========================================
  return {
    // Room lifecycle
    joinRoom,
    leaveRoom,
    startAudio,
    stopAudio,

    // Seat actions (from useSeatActions)
    ...seatActions,

    // Gift actions (from useRoomGifts)
    ...giftActions,

    // Chat
    sendChatMessage,

    // State
    connectionStatus,
    isConnected,
    isProducing,
    isLocalMuted,
    toggleLocalMute,
  };
}
