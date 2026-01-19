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
import { setupRoomEventHandlers, cleanupRoomEventHandlers } from './useRoomEventHandlers';
import { useSeatActions, type UseSeatActionsReturn } from './useSeatActions';
import { useRoomGifts, type UseRoomGiftsReturn } from './useRoomGifts';
import { useRoomChat } from './useRoomChat';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';
import { CONNECTION_TIMEOUT_MS } from '~/constants/room';

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
  /** Whether audio system is ready (device loaded + room joined) */
  isAudioReady: ComputedRef<boolean>;
}

// ============================================
// Cached Dependencies (Module-level)
// ============================================
// These are cached on first call to prevent inject() warnings when
// composable is accessed from socket callbacks outside Vue's setup context.

let _roomStore: ReturnType<typeof useRoomStore> | null = null;
let _authStore: ReturnType<typeof useAuthStore> | null = null;
let _giftStore: ReturnType<typeof useGiftStore> | null = null;
let _toast: ReturnType<typeof useToast> | null = null;

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
  // Initialize on first call only (during Vue setup context)
  if (!_roomStore) _roomStore = useRoomStore();
  if (!_authStore) _authStore = useAuthStore();
  if (!_giftStore) _giftStore = useGiftStore();
  if (!_toast) _toast = useToast();

  // Use cached references
  const roomStore = _roomStore;
  const authStore = _authStore;
  const giftStore = _giftStore;
  const toast = _toast;
  const log = createLogger('[RoomAudio]');

  // Socket and mediasoup instances
  const { socket, connect, disconnect: _disconnect, status: connectionStatus, isConnected } = useAudioSocket();
  const {
    loadDevice,
    createTransports,
    startAudio: startMediasoupAudio,
    stopAudio: stopMediasoupAudio,
    consumeProducer,
    cleanup: cleanupMediasoup,
    isDeviceLoaded,
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
  // Computed: Audio Ready State
  // ========================================
  /**
   * Whether the audio system is fully ready.
   * This is true when device is loaded and we're connected.
   * Used to prevent race conditions when user clicks seats too fast.
   */
  const isAudioReady = computed(() => isDeviceLoaded.value && isConnected.value);

  // ========================================
  // Helper: Emit with Promise (shared utility)
  // ========================================
  const emitAsync = createEmitAsync(socket);

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

  // Chat messaging
  const chatActions = useRoomChat({
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

      // Timeout after configured duration
      setTimeout(() => {
        unwatch();
        reject(new Error('Connection timeout'));
      }, CONNECTION_TIMEOUT_MS);
    });

    // Setup event listeners (delegated to useRoomEventHandlers)
    // Clean up any existing listeners first to prevent duplicates on rejoin
    if (socket.value) {
      cleanupRoomEventHandlers(socket.value);
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
    const ownerId = roomStore.currentRoom?.owner?.id;
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
      log.debug('Adding', response.participants.length, 'existing participants');
      for (const p of response.participants) {
        roomStore.addParticipant({
          id: p.id,
          name: p.name,
          signature: p.signature,
          email: p.email,
          phone: p.phone,
          avatar: p.avatar,
          gender: p.gender,
          country: p.country,
          date_of_birth: p.date_of_birth,
          wealth_xp: p.wealth_xp,
          charm_xp: p.charm_xp,
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
      log.debug('Consuming', response.existingProducers.length, 'existing producers');
      for (const producer of response.existingProducers) {
        try {
          await consumeProducer(producer.producerId, roomId);
        } catch (err) {
          log.warn('Failed to consume producer:', producer.producerId, err);
        }
      }
    }

    log.debug('Joined room:', roomId);
  }

  /**
   * Leave the current room and clean up all resources.
   * NOTE: Socket stays connected for app-wide events.
   */
  function leaveRoom(): void {
    if (socket.value && roomStore.currentRoom) {
      socket.value.emit('room:leave', { roomId: roomStore.currentRoom.id.toString() });
    }

    // Cleanup mediasoup
    cleanupMediasoup();

    // NOTE: Do NOT disconnect socket - it stays connected for app-wide events
    // Socket is managed by socket.client.ts plugin, disconnects only on logout

    // Clear room state
    roomStore.clearAudioState();

    log.debug('Left room (socket stays connected)');
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

    // Chat (from useRoomChat)
    ...chatActions,

    // State
    connectionStatus,
    isConnected,
    isProducing,
    isLocalMuted,
    toggleLocalMute,
    isAudioReady,
  };
}
