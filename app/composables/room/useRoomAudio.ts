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
import type { JoinRoomResponse, SelfMutePayload, SelfMuteResponse } from '~/types/room/audio';
import { userToParticipant } from '~/types/room/audio';
import type { Ref, ComputedRef } from 'vue';
import { setupRoomEventHandlers, cleanupRoomEventHandlers } from './useRoomEventHandlers';
import { useSeatActions, type UseSeatActionsReturn } from './useSeatActions';
import { useRoomGifts, clearGiftQueue, type UseRoomGiftsReturn } from './useRoomGifts';
import { useRoomChat } from './useRoomChat';
import { clearLuckyState } from '../lucky/useLuckyGift';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';
import { CONNECTION_TIMEOUT_MS } from '~/constants/room';
import { REGION_ENDPOINTS } from '~/constants/audio';
import { useRoomAudioPlayer } from './audio/useRoomAudioPlayer';
import { createParticipantPlaceholder } from '~/utils/room/participant-placeholder';
import { propToEntryAnimationGift } from '~/utils/prop';
import * as giftAssetCache from '~/services/giftAssetCache';

// ============================================
// Types
// ============================================

export interface UseRoomAudioReturn extends UseSeatActionsReturn, UseRoomGiftsReturn {
  /** Join a room with audio capabilities */
  joinRoom: (roomId: string) => Promise<void>;
  /** Leave the current room */
  leaveRoom: (roomId?: string) => void;
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
  /** Set volume for all consumer audio (0-1) */
  setVolume: (volume: number) => void;
  /** Recover remote playback after mobile/PWA resume */
  recoverPlayback: () => Promise<boolean>;
  /** Probe audio session health (used by lifecycle resume to avoid unnecessary rebuilds) */
  probeAudioHealth: () => Promise<'healthy' | 'needs-playback-recovery' | 'needs-rebuild'>;
  /** Audio player composable for music playback */
  audioPlayer: ReturnType<typeof import('./audio/useRoomAudioPlayer').useRoomAudioPlayer>;
}

// ============================================
// Cached Dependencies (Module-level)
// ============================================
// These are cached on first call to prevent inject() warnings when
// composable is accessed from socket callbacks outside Vue's setup context.

let _roomStore: ReturnType<typeof useRoomStore> | null = null;
let _audioStore: ReturnType<typeof useRoomAudioStore> | null = null;
let _seatsStore: ReturnType<typeof useRoomSeatsStore> | null = null;
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
  if (!_audioStore) _audioStore = useRoomAudioStore();
  if (!_seatsStore) _seatsStore = useRoomSeatsStore();
  if (!_authStore) _authStore = useAuthStore();
  if (!_giftStore) _giftStore = useGiftStore();
  if (!_toast) _toast = useToast();

  // Use cached references
  const roomStore = _roomStore;
  const audioStore = _audioStore;
  const seatsStore = _seatsStore;
  const authStore = _authStore;
  const giftStore = _giftStore;
  const toast = _toast;
  const log = createLogger('[RoomAudio]');

  const { resolveProp } = usePropLookup();

  // Media Session (background audio signal)
  const { activate: activateMediaSession, deactivate: deactivateMediaSession } = useMediaSession();

  // Socket and mediasoup instances
  const { socket, connect, disconnect: _disconnect, status: connectionStatus, isConnected } = useAudioSocket();
  const {
    loadDevice,
    createTransports,
    startAudio: startMediasoupAudio,
    stopAudio: stopMediasoupAudio,
    consumeProducer,
    stopConsumer,
    recoverPlayback,
    probeAudioHealth,
    cleanup: cleanupMediasoup,
    isDeviceLoaded,
    isProducing,
    isLocalMuted,
    toggleLocalMute: toggleMediasoupMute,
    producer,
    setVolume: setMediasoupVolume,
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
    audioStore.setProducing(false);
  }

  /**
   * Start producing audio from microphone.
   */
  async function startAudio(): Promise<void> {
    await startMediasoupAudio();
    audioStore.setProducing(true);
  }

  /**
   * Toggle local mute and notify the server.
   * Wraps the mediasoup track toggle to also emit audio:selfMute/audio:selfUnmute,
   * allowing the server to pause the producer and stop processing empty RTP packets.
   */
  function toggleLocalMute(): boolean {
    const isMuted = toggleMediasoupMute();
    const roomId = getCurrentRoomId();
    const producerId = producer.value?.id;

    if (roomId && producerId) {
      const event = isMuted ? 'audio:selfMute' : 'audio:selfUnmute';
      emitAsync<SelfMutePayload, SelfMuteResponse>(event, { roomId, producerId })
        .then((res) => {
          if (!res.success) {
            log.warn(`${event} failed:`, res.error);
          }
        })
        .catch((err) => {
          log.warn(`${event} emit error:`, err);
        });
    }

    return isMuted;
  }

  // ========================================
  // Sub-Composables (Delegated Logic)
  // ========================================

  // Seat actions (take, leave, assign, mute, lock, invite)
  const seatActions = useSeatActions({
    emitAsync,
    getCurrentRoomId,
    audioStore,
    seatsStore,
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

  // Audio player (music playback through mediasoup)
  const audioPlayer = useRoomAudioPlayer(socket);

  // ========================================
  // Room Lifecycle
  // ========================================

  /**
   * Join a room with audio capabilities.
   * Connects to audio server, joins room, and sets up transports.
   */
  async function joinRoom(roomId: string): Promise<void> {
    // Clear any stale gift playback from previous room
    giftStore.clearPlayback();

    // Connect to the correct regional MSAB endpoint (production only).
    // In development, always use the local MSAB URL from config to avoid
    // connecting to production endpoints that reject localhost origins.
    const isDev = import.meta.dev;
    const hostingRegion = roomStore.currentRoom?.hosting_region;
    const regionalUrl = !isDev && hostingRegion ? REGION_ENDPOINTS[hostingRegion] : undefined;
    await connect(regionalUrl);

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      if (isConnected.value) {
        resolve();
        return;
      }

      // Catch synchronous failures (e.g., "No MSAB token" sets status='error' immediately)
      if (connectionStatus.value === 'error') {
        reject(new Error('Failed to connect to audio server'));
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
        audioStore,
        seatsStore,
        authStore,
        giftStore,
        toast,
        leaveRoom,
        stopAudio,
        consumeProducer,
        stopConsumer,
        acceptInvite: seatActions.acceptInvite,
        declineInvite: seatActions.declineInvite,
        startAudio,
      });
    }

    // Join room via socket (send owner ID and seat count so server can configure room)
    const ownerId = roomStore.currentRoom?.owner_id;
    const seatCount = roomStore.currentRoom?.max_seats ?? 15;

    // log.debug('room:join payload:', { roomId, ownerId, seatCount, hasOwner: !!roomStore.currentRoom?.owner });

    const response = await emitAsync<{ roomId: string; ownerId: number; seatCount: number }, JoinRoomResponse>(
      'room:join',
      { roomId, ownerId: ownerId!, seatCount }
    );

    if (response.error || !response.rtpCapabilities) {
      throw new Error(response.error || 'Failed to join room');
    }

    // Load mediasoup device
    await loadDevice(response.rtpCapabilities);

    // Create transports
    await createTransports(roomId);

    // Update audio store
    audioStore.setAudioConnected(true);

    // Add self to participants
    if (authStore.user) {
      const participant = userToParticipant(
        {
          id: authStore.user.id,
          name: authStore.user.name,
          signature: authStore.user.signature,
          frame_id: authStore.user.frame_id,
          chat_bubble_id: authStore.user.chat_bubble_id,
          entry_animation_id: authStore.user.entry_animation_id,
          data_card_id: authStore.user.data_card_id,
          mice_wave_id: authStore.user.mice_wave_id,
          email: null,
          phone: authStore.user.phone ?? '',
          avatar: authStore.user.avatar,
          gender: authStore.user.gender,
          country: authStore.user.country ?? '',
          date_of_birth: authStore.user.date_of_birth,
          wealth_xp: authStore.user.wealth_xp,
          charm_xp: authStore.user.charm_xp,
          cover_image: authStore.user.cover_image ?? null,
          vip_level: authStore.user.vip_level ?? 0,
        }, { isSpeaker: false }
      );
      audioStore.addParticipant(participant);

      if (authStore.user.entry_animation_id) {
        const prop = resolveProp(authStore.user.entry_animation_id);
        if (prop) {
          giftStore.enqueuePlayback({
            gift: propToEntryAnimationGift(prop),
            senderId: authStore.user.id,
            senderName: authStore.user.name,
            senderAvatar: authStore.user.avatar ?? undefined,
            recipientIds: [],
            quantity: 1,
          });
        }
      }
    }

    // Handle initial room state from server
    // 1. Add existing participants
    const entryWarmIds = new Set<number>();
    if (response.participants && response.participants.length > 0) {
      // log.debug('Adding', response.participants.length, 'existing participants');
      for (const p of response.participants) {
        const participant = userToParticipant(
            {
              id: p.id,
              name: p.name,
              signature: p.signature,
              frame_id: p.frame_id,
              chat_bubble_id: p.chat_bubble_id,
              entry_animation_id: p.entry_animation_id,
              data_card_id: p.data_card_id,
              mice_wave_id: p.mice_wave_id,
              email: p.email,
              phone: p.phone,
              avatar: p.avatar,
              gender: p.gender,
              country: p.country,
              date_of_birth: p.date_of_birth,
              wealth_xp: p.wealth_xp,
              charm_xp: p.charm_xp,
              cover_image: p.cover_image ?? null,
              vip_level: p.vip_level ?? 0,
            }, { isSpeaker: false }
        );

        audioStore.addParticipant(participant);

        if (p.entry_animation_id) entryWarmIds.add(p.entry_animation_id);
      }
    }

    // REACT: warm the shared entry-animation prop assets (fire-and-forget),
    // deferred so the ~7MB-each downloads don't contend with the join
    // handshake / seat sync / gift catalog on slow mobile links. Later joiners
    // reusing the same popular prop then hit Cache Storage, not cold network.
    if (entryWarmIds.size > 0) {
      setTimeout(() => {
        for (const propId of entryWarmIds) {
          const entryProp = resolveProp(propId);
          if (entryProp) {
            void giftAssetCache.preloadGift(propToEntryAnimationGift(entryProp));
          }
        }
      }, 1500);
    }

    // 2. Initialize seats from server state
    if (response.seats) {
      const activeIds = audioStore.audioState.activeSpeakerIds;
      response.seats.forEach((seat) => {
        let user = seat.userId != null ? audioStore.participants.get(seat.userId) ?? null : null;
        if (seat.userId != null && !user) {
          user = createParticipantPlaceholder(seat.userId);
          audioStore.addParticipant(user);
        }
        seatsStore.updateSeat(seat.seatIndex, user, seat.isMuted, activeIds);
        if (user) {
          const p = audioStore.participants.get(user.id);
          if (p) {
            p.isSpeaker = true;
            p.seatIndex = seat.seatIndex;
          }
        }
      });
    }

    // Initialize locked seats (if provided by server)
    if (response.lockedSeats) {
      response.lockedSeats.forEach((seatIndex: number) => {
        seatsStore.setSeatLocked(seatIndex, true);
      });
    }

    // 3. Consume existing producers (listen to active speakers)
    if (response.existingProducers && response.existingProducers.length > 0) {
      // log.debug('Consuming', response.existingProducers.length, 'existing producers');
      for (const producer of response.existingProducers) {
        try {
          await consumeProducer(producer.producerId, roomId, producer.userId);
        } catch (err) {
          log.warn('Failed to consume producer:', producer.producerId, err);
        }
      }
    }

    // 4. Initialize audio player state from join response
    if (response.musicPlayer) {
      audioPlayer.initFromJoinState(response.musicPlayer);
    }
    audioPlayer.setupListeners();

    // Signal to OS that active audio is playing (keeps PWA/TWA alive in background)
    const room = roomStore.currentRoom;
    if (room) activateMediaSession(room.name, room.logo ?? null);

    // log.debug('Joined room:', roomId);
  }

  /**
   * Leave the current room and clean up all resources.
   * NOTE: Socket stays connected for app-wide events.
   */
  function leaveRoom(roomId?: string): void {
    const targetRoomId = roomId ?? roomStore.currentRoom?.id?.toString();
    if (socket.value && targetRoomId) {
      socket.value.emit('room:leave', { roomId: targetRoomId });
    }

    // Cleanup mediasoup
    cleanupMediasoup();

    // Clear pending gift queue to prevent stale gifts
    clearGiftQueue();

    // Clear lucky animation state
    clearLuckyState();

    // Stop any playing gift animation and flush playback queue
    giftStore.clearPlayback();

    // Cleanup audio player
    audioPlayer.cleanup(targetRoomId ?? undefined);

    // NOTE: Do NOT disconnect socket - it stays connected for app-wide events
    // Socket is managed by socket.client.ts plugin, disconnects only on logout

    // Clear room state
    audioStore.clearAudioState();
    seatsStore.resetSeats();

    // Clear OS media session
    deactivateMediaSession();

    // log.debug('Left room (socket stays connected)');
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

    // Volume
    setVolume: setMediasoupVolume,
    recoverPlayback,
    probeAudioHealth,

    // Audio player
    audioPlayer,
  };
}
