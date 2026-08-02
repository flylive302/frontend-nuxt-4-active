/**
 * Room Audio Composable - Orchestrator
 *
 * Main orchestrator that combines socket connection, mediasoup, and room state management.
 * Delegates to specialized composables for modularity and extensibility.
 *
 * @see useSeatActions.ts - Seat management operations
 * @see useRoomEventHandlers.ts - Socket event handlers
 * @see useRoomGifts.ts - Gift burst sending
 */
import type { JoinRoomResponse, SelfMutePayload, SelfMuteResponse } from '~/types/room/audio';
import { userToParticipant } from '~/types/room/audio';
import type { Ref, ComputedRef, EffectScope } from 'vue';
import { setupRoomEventHandlers, cleanupRoomEventHandlers } from './useRoomEventHandlers';
import { useSeatActions, type UseSeatActionsReturn } from './useSeatActions';
import { useRoomGifts, type UseRoomGiftsReturn } from './useRoomGifts';
import { useRoomChat } from './useRoomChat';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';
import { CONNECTION_TIMEOUT_MS, DEFAULT_SEAT_COUNT } from '~/constants/room';
import { useRoomAudioPlayer } from './audio/useRoomAudioPlayer';
import { useSilentJoinDetection, type SilentJoinWatchHandle } from './useSilentJoinDetection';
import { useBroadcastHlsPlayback } from './audio/useBroadcastHlsPlayback';
import { selectMediaTransport, planTransportHandoff, type MediaTransport } from '~/utils/mediaTransport';
import { propToEntryAnimationGift } from '~/utils/prop';
import * as giftAssetCache from '~/services/giftAssetCache';
import * as fgsCoordinator from '~/services/foregroundServiceCoordinator';
import { resolveSocketErrorMessage, isRoomBlockedSocketError, RoomBlockedError } from '~/utils/socket/socketErrorMessages';

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
  /** Register the owner for terminal transport failure (audio-pipe-observability 10) */
  onTransportExhausted: (cb: () => void) => void;
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
let _participantsStore: ReturnType<typeof useRoomParticipantsStore> | null = null;
let _seatsStore: ReturnType<typeof useRoomSeatsStore> | null = null;
let _authStore: ReturnType<typeof useAuthStore> | null = null;
let _giftStore: ReturnType<typeof useGiftStore> | null = null;
let _toast: ReturnType<typeof useToast> | null = null;

/**
 * Room id the self entry-animation was last played for. Gates replay: a
 * reconnect / resume / un-minimize calls joinRoom again for the SAME room and
 * must NOT re-trigger the entry; only a genuine room switch (different id)
 * should. Cleared in leaveRoom() so re-entering the same room later replays.
 */
let lastSelfEntryRoomId: string | null = null;

/**
 * Room id the self slide overlay was last played for. Same replay-guard
 * rationale as lastSelfEntryRoomId — reconnect / resume / un-minimize must
 * NOT re-trigger the slide for the same room. Cleared in leaveRoom().
 */
let lastSelfSlideRoomId: string | null = null;

/**
 * Room id the self join chat message was last sent for. Same replay-guard
 * rationale as lastSelfEntryRoomId. Cleared in leaveRoom().
 */
let lastSelfJoinMessageRoomId: string | null = null;

/**
 * Detached effect scope owning the process-wide microphone foreground-service
 * watch (capacitor-03). It MUST be a `effectScope(true)` (detached), NOT a bare
 * `watch()` in the composable body: `useRoomAudio()` is first called inside a
 * room component's `setup()`, so a body-level watcher would bind to that
 * component's scope and Vue would auto-dispose it on unmount — after which
 * re-entering a room would never re-arm the mic FGS (silently breaking both
 * halves of AC #2). A detached scope is ownerless and lives for the app process.
 * Created once (`fgsScope ??=`); the coordinator is a no-op off Android, so the
 * always-on watch is harmless on web/iOS.
 */
let fgsScope: EffectScope | null = null;

/** Install the singleton FGS watch in a detached scope (idempotent). */
function ensureFgsWatch(
  audioStore: ReturnType<typeof useRoomAudioStore>,
  roomStore: ReturnType<typeof useRoomStore>,
): void {
  if (fgsScope) return;
  fgsScope = effectScope(true);
  fgsScope.run(() => {
    watch(
      // Two orthogonal drivers (capacitor-04):
      //   • producing — open mic on a Seat → `microphone` FGS (capacitor-03).
      //   • consuming — being IN A ROOM SESSION → `mediaPlayback` FGS. Bound to
      //     `currentRoom` (set on join, cleared only by leaveRoom), NOT
      //     `isConnected`: the FGS must represent session intent and ride out
      //     transport reconnects, not flap on every blip and free the OS to
      //     freeze the process mid-recovery (D2, protects ADR-0002 grace).
      () => [audioStore.audioState.isProducing, roomStore.currentRoom !== null] as const,
      () => {
        void fgsCoordinator.apply({
          producing: audioStore.audioState.isProducing,
          consuming: roomStore.currentRoom !== null,
        });
      },
      // immediate: `currentRoom` is set in doEnterRoom() BEFORE the room page
      // mounts and first calls useRoomAudio() (which installs this watch). A
      // non-immediate watch would miss that already-done-issues null→room transition and
      // never start the mediaPlayback FGS for a pure Listener. On install it
      // reconciles against current state: a no-op when not in a room (empty
      // running set), or starts mediaPlayback when already in one. The detached
      // scope still drives every later enter/leave reactively.
      { immediate: true },
    );
  });
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
  // Initialize on first call only (during Vue setup context)
  if (!_roomStore) _roomStore = useRoomStore();
  if (!_audioStore) _audioStore = useRoomAudioStore();
  if (!_participantsStore) _participantsStore = useRoomParticipantsStore();
  if (!_seatsStore) _seatsStore = useRoomSeatsStore();
  if (!_authStore) _authStore = useAuthStore();
  if (!_giftStore) _giftStore = useGiftStore();
  if (!_toast) _toast = useToast();

  // Use cached references
  const roomStore = _roomStore;
  const audioStore = _audioStore;
  const participantsStore = _participantsStore;
  const seatsStore = _seatsStore;
  const authStore = _authStore;
  const giftStore = _giftStore;
  const toast = _toast;
  const log = createLogger('[RoomAudio]');

  const { resolveProp, resolvePropAsync } = usePropLookup();
  const { playEntrySlide, admitPayload: admitSlidePayload, clearAll: clearAllSlides } = useSlidePlayback();
  const { ensureLoaded: ensureGiftsLoaded } = useGiftData();

  // Media Session (background audio signal)
  const { activate: activateMediaSession, deactivate: deactivateMediaSession } = useMediaSession();

  // Socket and mediasoup instances
  const { socket, connect, disconnect: _disconnect, status: connectionStatus, isConnected } = useAudioSocket();
  const {
    loadDevice,
    createTransports,
    onTransportExhausted,
    startAudio: startMediasoupAudio,
    stopAudio: stopMediasoupAudio,
    restartAudio: restartMediasoupAudio,
    isMicPipelineDead,
    consumeProducer,
    stopConsumer,
    recoverPlayback: recoverMediasoupPlayback,
    probeAudioHealth,
    cleanup: cleanupMediasoup,
    isDeviceLoaded,
    isProducing,
    isLocalMuted,
    toggleLocalMute: toggleMediasoupMute,
    reapplyMuteToProducer,
    producer,
    setVolume: setMediasoupVolume,
    getVolume: getMediasoupVolume,
  } = useMediasoup(socket);

  // ========================================
  // Foreground services (capacitor-03 mic + capacitor-04 mediaPlayback)
  // ========================================
  // Drive the FGS coordinator off the two sources of truth: `isProducing` (mic,
  // catches EVERY way a Speaker stops producing — self-leave-seat, server-side
  // seat kick, leaveRoom) and `currentRoom` presence (mediaPlayback, the room
  // session). Installed in a detached scope (see ensureFgsWatch) so it survives
  // component unmount/remount; coordinator is a no-op off Android.
  ensureFgsWatch(audioStore, roomStore);

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
    // GATE: unmuting into a dead mic pipeline (transport ICE-dead, producer
    // closed by a reconnect, OS released the mic during a long mute) cannot be
    // fixed by re-enabling the track — the user would look unmuted but stay
    // silent until they leave + retake the seat. Rebuild the pipeline instead.
    if (isLocalMuted.value && isMicPipelineDead()) {
      void recoverUnmute();
      return false;
    }

    const isMuted = toggleMediasoupMute();
    emitMuteState(isMuted);
    return isMuted;
  }

  /**
   * Unmute recovery: full mic pipeline rebuild (same effect as leave + retake
   * seat). The fresh producer starts unpaused server-side; the selfUnmute emit
   * carries the NEW producer id so the room's mute UI flips for everyone.
   */
  async function recoverUnmute(): Promise<void> {
    try {
      await restartMediasoupAudio();
      audioStore.setProducing(true);
      emitMuteState(false);
    } catch (err) {
      log.warn('Failed to rebuild mic pipeline on unmute', err);
      toast.add({
        title: 'Could not unmute',
        description: 'Please leave the seat and take it again.',
        color: 'error',
      });
    }
  }

  /** Notify the server of the local mute state so it can pause/resume the producer. */
  function emitMuteState(isMuted: boolean): void {
    const roomId = getCurrentRoomId();
    const producerId = producer.value?.id;
    if (!roomId || !producerId) return;

    const event = isMuted ? 'audio:selfMute' : 'audio:selfUnmute';
    emitAsync<SelfMutePayload, SelfMuteResponse>(event, { roomId, producerId })
      .then((res) => {
        if (!res.success) {
          log.warn('Server rejected mute toggle')
        }
      })
      .catch((err) => {
        log.warn('Failed to emit mute toggle to server', err)
      });
  }

  // ========================================
  // Sub-Composables (Delegated Logic)
  // ========================================

  // Seat actions (take, leave, assign, mute, lock, invite)
  const seatActions = useSeatActions({
    emitAsync,
    getCurrentRoomId,
    audioStore,
    participantsStore,
    seatsStore,
    authStore,
    toast,
    stopAudio,
  });

  // Gift sending (burst send, prepare)
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

  // observability-audio-quality 13: silent-join detection. Instrumentation
  // only — it observes the join, it never steers it.
  const silentJoin = useSilentJoinDetection();
  let silentJoinWatch: SilentJoinWatchHandle | null = null;

  // realtime-09: broadcast-tier HLS playback for passive Listeners. When the Room
  // is in broadcast mode and the local user is NOT a Speaker, play the single CDN
  // HLS stream instead of N WebRTC consumers, muting the WebRTC tier so only one
  // is audible. Speakers and interactive rooms stay on WebRTC. Additive + guarded:
  // it never touches the WebRTC pipeline beyond volume, so the existing audio path
  // is unaffected when broadcast HLS isn't active.
  const broadcastHls = useBroadcastHlsPlayback();

  // realtime-09: on mobile/PWA resume, recover BOTH tiers — the WebRTC remote
  // playback and (if active) the broadcast HLS element (autoplay may have been
  // suspended in the background).
  async function recoverPlayback(): Promise<boolean> {
    const ok = await recoverMediasoupPlayback();
    await broadcastHls.resume();
    return ok;
  }

  // realtime-10: HLS↔WebRTC promotion/demotion handoff.
  //
  // `activeTransport` is the tier this client is currently on, tracked
  // SYNCHRONOUSLY here rather than read back from `broadcastHls.isActive` —
  // which only flips true AFTER the async `import('hls.js')` inside start().
  // A promotion (take Seat → isProducing) landing in that import window would,
  // with the old `else if (broadcastHls.isActive.value)` guard, skip the volume
  // restore and strand the WebRTC tier at volume 0 → the demoted-then-promoted
  // Listener goes silent. Edge-triggering off this flag closes that race.
  //
  // `webrtcVolume` remembers the Listener's chosen consumer volume across a
  // broadcast detour so the restore doesn't clobber it back to a hardcoded 1.
  let activeTransport: MediaTransport = 'webrtc';
  let webrtcVolume = getMediasoupVolume();

  watch(
    () => {
      const room = roomStore.currentRoom;
      return [
        room?.mode ?? 'interactive',
        isProducing.value,
        room?.hls_playback_url ?? null,
      ] as const;
    },
    ([mode, isSpeaker, hlsUrl]) => {
      const transport = selectMediaTransport({ mode, isSpeaker, hlsPlaybackUrl: hlsUrl });
      const plan = planTransportHandoff(activeTransport, transport, webrtcVolume);
      if (!plan.changed) return; // already on the target tier → nothing to do

      activeTransport = plan.tier;
      if (plan.tier === 'hls' && hlsUrl) {
        // WebRTC → HLS (a Speaker stepping down, or the Room flipping to
        // broadcast): silence the muted WebRTC consumers and play the single
        // CDN stream at the same volume. One catch-up jump, no reconnect storm.
        setMediasoupVolume(plan.webrtcVolume);
        broadcastHls.setVolume(plan.hlsVolume ?? webrtcVolume);
        void broadcastHls.start(hlsUrl);
      } else {
        // HLS → WebRTC (a Listener taking a Seat, or the Room flipping back to
        // interactive): stop the CDN stream and restore the Listener's chosen
        // WebRTC volume. Restore is UNCONDITIONAL (not gated on
        // broadcastHls.isActive) so a switch during the hls.js import can't
        // leave WebRTC muted.
        broadcastHls.stop();
        setMediasoupVolume(plan.webrtcVolume);
      }
    },
    { immediate: true },
  );

  /**
   * Set consumer volume, tier-aware (realtime-10): drives the HLS element while
   * on the broadcast tier and the WebRTC consumers otherwise, and remembers the
   * value so a later HLS→WebRTC handoff restores it instead of hardcoding 1.
   */
  function setVolume(volume: number): void {
    webrtcVolume = volume;
    if (activeTransport === 'hls') {
      broadcastHls.setVolume(volume);
    } else {
      setMediasoupVolume(volume);
    }
  }

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

    // Ensure the gift catalog is loaded for THIS participant before gifts can
    // arrive — fire-and-forget, idempotent (guards on isInitialized/isLoading).
    // Catalog loading used to be owned by the gift drawer's onMounted, leaving a
    // race where an early `gift:received` on a passive listener (who never
    // opened the drawer) found an empty catalog and silently dropped the
    // animation. Owning it at room entry removes that dependency.
    void ensureGiftsLoaded();

    // Connect to the Laravel-authoritative MSAB endpoint (realtime-05).
    // In development this resolves to undefined so connect() uses the local
    // config URL (prod endpoints reject localhost origins).
    const hostingUrl = roomStore.currentRoom?.hosting_url;
    if (!import.meta.dev && !hostingUrl) {
      // hosting_url is Laravel-guaranteed on every room payload; its absence in
      // prod signals a backend regression. Surface it instead of silently
      // falling back to the config default endpoint (realtime-05, AC#2).
      log.error('Missing hosting_url on current room — cannot resolve MSAB endpoint', {
        roomId,
      });
    }
    const targetUrl = resolveMediaTransportUrl(hostingUrl, import.meta.dev);
    await connect(targetUrl);

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
      setupRoomEventHandlers(
        socket.value,
        {
          leaveRoom,
          stopAudio,
          consumeProducer,
          stopConsumer,
          acceptInvite: seatActions.acceptInvite,
          declineInvite: seatActions.declineInvite,
          startAudio,
        },
        toast,
      );
    }

    // Join room via socket (send owner ID and seat count so server can configure room)
    const ownerId = roomStore.currentRoom?.owner_id;
    const seatCount = roomStore.currentRoom?.max_seats ?? DEFAULT_SEAT_COUNT;

    // undefined

    const response = await emitAsync<{ roomId: string; ownerId: number; seatCount: number }, JoinRoomResponse>(
      'room:join',
      { roomId, ownerId: ownerId!, seatCount }
    );

    if (response.error || !response.rtpCapabilities) {
      const message = resolveSocketErrorMessage(response.error, 'Failed to join room', {
        permanent: response.permanent,
        remaining_seconds: response.remaining_seconds,
      });
      if (isRoomBlockedSocketError(response.error)) {
        throw new RoomBlockedError(message);
      }
      throw new Error(message);
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
          slides_id: authStore.user.slides_id,
          avatar: authStore.user.avatar,
          gender: authStore.user.gender,
          country: authStore.user.country ?? '',
          date_of_birth: authStore.user.date_of_birth,
          wealth_xp: authStore.user.wealth_xp,
          charm_xp: authStore.user.charm_xp,
          cover_image: authStore.user.cover_image ?? null,
          vip_level: authStore.user.vip_level ?? 0,
          equipped_badges: authStore.user.equipped_badges,
        }
      );
      participantsStore.addParticipant(participant);

      // Self entry-animation. Mirror the others' path (room:userJoined): resolve
      // the prop ASYNCHRONOUSLY (failsafe-fetches on a prop-index cache miss) so
      // it isn't silently skipped before the index has seeded, and run it
      // fire-and-forget so a slow prop fetch never delays the join handshake.
      // Gate on lastSelfEntryRoomId so reconnect / resume / un-minimize to the
      // SAME room doesn't replay — only a genuine room switch does.
      if (
        authStore.user.entry_animation_id &&
        !roomStore.isMinimized &&
        roomId !== lastSelfEntryRoomId
      ) {
        lastSelfEntryRoomId = roomId;
        const selfUser = authStore.user;
        void (async () => {
          const prop = await resolvePropAsync(selfUser.entry_animation_id);
          if (!prop) return;
          giftStore.enqueuePlayback({
            gift: propToEntryAnimationGift(prop),
            senderId: selfUser.id,
            senderName: selfUser.name,
            senderAvatar: selfUser.avatar ?? undefined,
            recipientIds: [],
            quantity: 1,
            isEntryAnimation: true,
          });
        })();
      }

      // Self entry slide. Same two-path rationale as the entry animation above —
      // MSAB's room:userJoined is emitted via socket.to(roomId), excluding the
      // joiner, so we trigger our own slide here. Resolved locally and admitted
      // into the one slide engine. Replay guard mirrors lastSelfEntryRoomId.
      if (
        authStore.user.slides_id &&
        !roomStore.isMinimized &&
        roomId !== lastSelfSlideRoomId
      ) {
        lastSelfSlideRoomId = roomId;
        const selfUser = authStore.user;
        void (async () => {
          const prop = await resolvePropAsync(selfUser.slides_id);
          if (!prop?.slide) return;
          playEntrySlide(prop.slide, {
            userId: selfUser.id,
            userName: selfUser.name,
            userAvatar: selfUser.avatar ?? null,
            roomName: roomStore.currentRoom?.name ?? '',
          });
        })();
      }

      if (roomId !== lastSelfJoinMessageRoomId) {
        lastSelfJoinMessageRoomId = roomId;
        chatActions.sendChatMessage(`${authStore.user.name} have entered the room`);
      }
    }

    // Handle initial room state from server.
    // 1. Reconcile existing participants against the snapshot (authoritative).
    //    Upsert everyone present, prune anyone absent (except self) — so a
    //    re-join (reconnect / resume / un-minimize) self-heals instead of
    //    merging the snapshot onto stale state and accumulating ghosts.
    const entryWarmIds = new Set<number>();
    const snapshotParticipants = (response.participants ?? []).map((p) => {
      if (p.entry_animation_id) entryWarmIds.add(p.entry_animation_id);
      return userToParticipant(p);
    });
    participantsStore.reconcileParticipants(snapshotParticipants, authStore.user?.id);

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

    // 2. Reconcile seats from server state (authoritative): apply occupied
    //    seats from the snapshot, clear seats whose occupant is absent. Resolve
    //    each occupant from participants (placeholder if a seat references a
    //    user the snapshot's participant list didn't carry).
    // Size the seat array to the room's max_seats BEFORE reconciling, so seats
    // beyond the default count (e.g. 16–20) exist before the snapshot targets
    // them (updateSeat's bounds guard would otherwise drop those occupancies).
    seatsStore.setSeatCount(seatCount);

    if (response.seats) {
      const snapshot = response.seats.map((seat) => ({
        seatIndex: seat.seatIndex,
        occupantId: seat.userId ?? null,
        isMuted: seat.isMuted,
      }));

      seatsStore.reconcileSeats(snapshot);
    }

    // Initialize locked seats (if provided by server)
    if (response.lockedSeats) {
      response.lockedSeats.forEach((seatIndex: number) => {
        seatsStore.setSeatLocked(seatIndex, true);
      });
    }

    // realtime-22: seat retention re-produce. If MSAB held our seat through a
    // reconnect grace window, the snapshot still lists us as an occupant — but our
    // mic producer died with the old socket. Re-establish it so we come back as a
    // speaker, not a silent seat. The pure predicate no-ops on a fresh join (we are
    // never in our own join snapshot) and when already producing (guards a benign
    // rejoin from double-producing). Covers every rejoin path — onReconnect,
    // reconnect-failed rebuild, PWA resume — since they all funnel through joinRoom.
    if (
      // Guard with the LIVE mediasoup state, not the store flag: the store's
      // isProducing is only cleared by an explicit stopAudio, so it stays
      // stale-true when the producer dies with the old transport on reconnect
      // — which skipped the re-produce and left a silent seat (the
      // long-mute audio-loss bug). The computed reflects the actual producer.
      shouldReproduceOnReclaim(
        response.seats,
        authStore.user?.id,
        isProducing.value,
      )
    ) {
      try {
        await startAudio();
        // audio-pipe-observability 12: the fresh getUserMedia track is enabled
        // by default and this rejoin path does NOT reset isLocalMuted — so a
        // muted user reconnecting would silently go LIVE (hot mic) while the UI
        // still shows muted. Preserve the mute: disable the new track locally,
        // and reconcile the server + every other user's mute indicator to the
        // NEW producer. Scoped here (the single rejoin re-produce funnel) so it
        // never collides with recoverUnmute, which intentionally goes live while
        // isLocalMuted is still true.
        if (isLocalMuted.value) {
          reapplyMuteToProducer();
          emitMuteState(true);
        }
      } catch (err) {
        log.warn('Failed to re-produce audio after seat reclaim', err);
      }
    }

    // 3. Consume existing producers (listen to active speakers)
    if (response.existingProducers && response.existingProducers.length > 0) {
      // undefined
      for (const producer of response.existingProducers) {
        try {
          // Compat: a catch-up entry without `source` (pre-feature server) is
          // treated as `mic`.
          await consumeProducer(producer.producerId, roomId, producer.userId, producer.source ?? 'mic');
        } catch (err) {
          log.warn('Failed to consume producer', err)
        }
      }
    }

    // 4. Initialize audio player state from join response
    if (response.musicPlayer) {
      audioPlayer.initFromJoinState(response.musicPlayer);
    }
    audioPlayer.setupListeners();

    // 5. Replay any app-scope slide still playing app-wide, so a late joiner
    // catches it too. Admission gates on currentRoom (set above) and coalesces
    // through the same SlideQueue as live `slide:play` events.
    for (const slide of response.activeAppSlides ?? []) {
      admitSlidePayload(slide);
    }

    // Signal to OS that active audio is playing (keeps PWA/TWA alive in background)
    const room = roomStore.currentRoom;
    if (room) activateMediaSession(room.name, room.logo ?? null);

    // 6. observability-audio-quality 13: start watching whether audio actually
    // arrives. Detection only — nothing below this line changes what the user
    // sees or hears. Fire-and-forget: the handle is cancelled on leave so a
    // user who departs mid-window is never reported as a silent join.
    if (room) {
      silentJoinWatch?.cancel();
      silentJoinWatch = silentJoin.observeJoin({
        roomId: room.id,
        seated: seatsStore.speakerIds.has(authStore.user?.id ?? -1),
      });
    }

    // undefined
  }

  /**
   * Leave the current room and clean up all resources.
   * NOTE: Socket stays connected for app-wide events.
   */
  function leaveRoom(roomId?: string): void {
    // Abandon any in-flight silent-join observation FIRST. A user who leaves
    // four seconds in never gave the join a chance to deliver audio, and
    // reporting them would be this instrument's largest false-positive source.
    silentJoinWatch?.cancel();
    silentJoinWatch = null;

    useGiftComboStore().$reset();

    const targetRoomId = roomId ?? roomStore.currentRoom?.id?.toString();
    if (socket.value && targetRoomId) {
      socket.value.emit('room:leave', { roomId: targetRoomId });
    }

    // Cleanup mediasoup (closes producers/consumers via mediasoup API)
    cleanupMediasoup();
    // Reset mediasoup session state (closes audio elements, clears Maps)
    useMediasoupSessionStore().$reset();

    // Clear lucky animation state
    useLuckySessionStore().$reset();

    // Stop any playing gift animation and flush playback queue
    giftStore.clearPlayback();

    // Free in-memory gift blob URLs (L2 Cache Storage persists for re-entry)
    giftAssetCache.clearVideoCache();

    // Cleanup audio player
    audioPlayer.cleanup(targetRoomId ?? undefined);

    // realtime-09: tear down broadcast HLS playback if it was active.
    // realtime-10: reset the tier flag in lockstep so the invariant "HLS
    // stopped ⟺ activeTransport==='webrtc'" holds — otherwise a rejoin to a
    // still-broadcast Room would hit the watch's same-transport early-return
    // and never restart HLS (silent Listener).
    broadcastHls.stop();
    activeTransport = 'webrtc';

    // NOTE: Do NOT disconnect socket - it stays connected for app-wide events
    // Socket is managed by socket.client.ts plugin, disconnects only on logout

    // Allow the self entry-animation to replay if the user re-enters this room.
    lastSelfEntryRoomId = null;
    // Same rationale for the slide overlay.
    lastSelfSlideRoomId = null;
    lastSelfJoinMessageRoomId = null;
    // Drop all slides (entry banners, room + app-scope gift/lucky slides):
    // every scope plays only inside a room now, so none should outlive the leave.
    // See ADR 0009.
    clearAllSlides();

    // Clear room state
    audioStore.clearAudioState();
    participantsStore.clear();
    seatsStore.resetSeats();

    // Clear OS media session
    deactivateMediaSession();

    // undefined
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

    // Volume (tier-aware: HLS while broadcasting, WebRTC otherwise)
    setVolume,
    recoverPlayback,
    probeAudioHealth,

    // Transport recovery ownership (audio-pipe-observability 10)
    onTransportExhausted,

    // Audio player
    audioPlayer,
  };
}
