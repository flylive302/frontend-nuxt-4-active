/**
 * Room Audio Player Composable
 *
 * Manages local audio file playback through the existing mediasoup producer transport.
 * Uses Web Audio API to decode audio files and produce MediaStreamTracks
 * that are sent through the same pipeline as microphone audio.
 *
 * Architecture:
 * - AudioContext decodes file → AudioBufferSourceNode → GainNode → MediaStreamDestination
 * - The resulting MediaStreamTrack is produced via the existing mediasoup transport
 * - MSAB coordinates mutex (one music player per room) and metadata broadcasting
 * - All playback control (play/pause/seek/stop) happens locally on the client
 */
import type { Ref } from 'vue';
import type { AudioSocket } from '../useAudioSocket';
import type {
  AudioPlayerState,
  AudioPlayerPlayPayload,
  AudioPlayerStopPayload,
  AudioPlayerStateUpdatePayload,
  AudioPlayerStateChangedEvent,
  AudioPlayerResponse,
  MusicPlayerJoinState,
} from '~/types/room/audio-player';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';

// ============================================
// Module-level state (singleton across composable calls)
// ============================================
const playerState = reactive<AudioPlayerState>({
  status: 'idle',
  userId: null,
  title: null,
  duration: 0,
  position: 0,
});

// Web Audio API state (not reactive — internal only)
let audioContext: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let sourceNodeStarted = false; // track whether start() was called — stop() without start() throws InvalidStateError
let gainNode: GainNode | null = null;
let destinationNode: MediaStreamAudioDestinationNode | null = null;
let positionInterval: ReturnType<typeof setInterval> | null = null;
let stateUpdateInterval: ReturnType<typeof setInterval> | null = null;
let playbackStartTime = 0;       // AudioContext.currentTime when playback started
let playbackStartOffset = 0;     // Offset in seconds (for seek)

// ============================================
// Composable
// ============================================

/**
 * Room Audio Player — plays local audio files through mediasoup.
 *
 * @param socket - Ref to the audio socket connection
 */
export function useRoomAudioPlayer(socket: Ref<AudioSocket | null>) {
  const log = createLogger('[AudioPlayer]');
  const emitAsync = createEmitAsync(socket);

  // Cache store refs at init (Vue setup context) — play()/seek() may be called
  // from socket callbacks or timers outside setup, where useXStore() would throw.
  const authStore = useAuthStore();
  const roomStore = useRoomStore();

  // ========================================
  // Computed
  // ========================================
  const isPlaying = computed(() => playerState.status === 'playing');
  const isPaused = computed(() => playerState.status === 'paused');
  const isActive = computed(() => playerState.status === 'playing' || playerState.status === 'paused');
  const isMusicPlayingInRoom = computed(() => playerState.userId !== null && playerState.status !== 'idle' && playerState.status !== 'stopped');

  // ========================================
  // Internal: Web Audio API helpers
  // ========================================

  function ensureAudioContext(): AudioContext {
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioContext();
    }
    return audioContext;
  }

  function getCurrentPosition(): number {
    if (!audioContext || playerState.status !== 'playing') {
      return playbackStartOffset;
    }
    return playbackStartOffset + (audioContext.currentTime - playbackStartTime);
  }

  function startPositionTracking(): void {
    stopPositionTracking();
    positionInterval = setInterval(() => {
      playerState.position = getCurrentPosition();
    }, 250); // Update UI 4x per second
  }

  function stopPositionTracking(): void {
    if (positionInterval) {
      clearInterval(positionInterval);
      positionInterval = null;
    }
  }

  function startStateUpdates(roomId: string): void {
    stopStateUpdates();
    stateUpdateInterval = setInterval(() => {
      if (!socket.value) return;
      socket.value.emit('audioPlayer:stateUpdate', {
        roomId,
        position: getCurrentPosition(),
        isPaused: playerState.status === 'paused',
      } satisfies AudioPlayerStateUpdatePayload);
    }, 2000); // Send state to MSAB every 2s
  }

  function stopStateUpdates(): void {
    if (stateUpdateInterval) {
      clearInterval(stateUpdateInterval);
      stateUpdateInterval = null;
    }
  }

  // ========================================
  // Public: Load an audio file
  // ========================================

  /**
   * Load an audio file from the user's device into the AudioBuffer.
   * Does NOT start playback — call play() after loading.
   *
   * @returns Track title (filename) and duration
   */
  async function loadFile(file: File): Promise<{ title: string; duration: number }> {
    playerState.status = 'loading';

    const ctx = ensureAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const title = file.name.replace(/\.[^.]+$/, ''); // Strip extension
    const duration = audioBuffer.duration;


    // Pre-set title and duration so play() has them
    playerState.title = title;
    playerState.duration = duration;
    playerState.status = 'idle';
    return { title, duration };
  }

  // ========================================
  // Public: Playback Controls
  // ========================================

  /**
   * Start playing the loaded audio file through mediasoup.
   * Acquires the MSAB mutex, builds the Web Audio graph,
   * and returns the MediaStreamTrack for the producer.
   *
   * @param roomId - Current room ID
   * @returns The MediaStreamTrack to produce via mediasoup, or null on failure
   */
  async function play(roomId: string): Promise<MediaStreamTrack | null> {
    if (!audioBuffer) {
      return null;
    }

    const title = playerState.title || 'Unknown';
    const duration = audioBuffer.duration;

    // Acquire MSAB mutex
    const res = await emitAsync<AudioPlayerPlayPayload, AudioPlayerResponse>(
      'audioPlayer:play',
      { roomId, title, duration },
    );

    if (!res.success) {
      return null;
    }

    // Build Web Audio graph
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    gainNode = ctx.createGain();
    destinationNode = ctx.createMediaStreamDestination();
    gainNode.connect(destinationNode);
    // Also connect to speakers so the sender hears their own music
    gainNode.connect(ctx.destination);

    sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(gainNode);

    // Handle track ending naturally
    sourceNode.onended = () => {
      if (playerState.status === 'playing') {
        stop(roomId);
      }
    };

    // Start playback
    sourceNode.start(0, playbackStartOffset);
    sourceNodeStarted = true;
    playbackStartTime = ctx.currentTime;

    // Update state
    playerState.status = 'playing';
    playerState.userId = authStore.user?.id ?? null;
    playerState.title = title;
    playerState.duration = duration;
    playerState.position = playbackStartOffset;

    startPositionTracking();
    startStateUpdates(roomId);


    // Return the track for the caller to produce via mediasoup
    return destinationNode.stream.getAudioTracks()[0] ?? null;
  }

  /**
   * Pause playback. Suspends the AudioContext so the producer sends silence.
   */
  async function pause(): Promise<void> {
    if (!audioContext || playerState.status !== 'playing') return;

    playbackStartOffset = getCurrentPosition();
    await audioContext.suspend();

    playerState.status = 'paused';
    playerState.position = playbackStartOffset;
    stopPositionTracking();

  }

  /**
   * Resume playback from the paused position.
   */
  async function resume(): Promise<void> {
    if (!audioContext || playerState.status !== 'paused') return;

    await audioContext.resume();
    playbackStartTime = audioContext.currentTime;

    playerState.status = 'playing';
    startPositionTracking();

  }

  /**
   * Seek to a specific position (in seconds).
   * Recreates the source node with the new offset.
   */
  function seek(position: number): void {
    if (!audioContext || !audioBuffer || !gainNode) return;

    const clampedPos = Math.max(0, Math.min(position, audioBuffer.duration));

    // Stop current source (only call stop() if start() was previously called)
    if (sourceNode) {
      sourceNode.onended = null;
      if (sourceNodeStarted) {
        try { sourceNode.stop(); } catch { /* already stopped */ }
      }
      sourceNode.disconnect();
      sourceNodeStarted = false;
    }

    // Create new source at the seek position
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(gainNode);

    sourceNode.onended = () => {
      if (playerState.status === 'playing') {
        const roomId = roomStore.currentRoom?.id?.toString();
        if (roomId) stop(roomId);
      }
    };

    playbackStartOffset = clampedPos;
    playerState.position = clampedPos;

    if (playerState.status === 'playing') {
      sourceNode.start(0, clampedPos);
      sourceNodeStarted = true;
      playbackStartTime = audioContext.currentTime;
    }

  }

  /**
   * Stop playback entirely. Releases the MSAB mutex.
   * The caller is responsible for closing/replacing the mediasoup producer track.
   *
   * @param roomId - Current room ID
   */
  async function stop(roomId: string): Promise<void> {
    stopPositionTracking();
    stopStateUpdates();

    // Stop and disconnect Web Audio nodes
    if (sourceNode) {
      sourceNode.onended = null;
      if (sourceNodeStarted) {
        try { sourceNode.stop(); } catch { /* already stopped */ }
      }
      sourceNode.disconnect();
      sourceNode = null;
      sourceNodeStarted = false;
    }
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
    if (destinationNode) {
      destinationNode = null;
    }

    playbackStartOffset = 0;
    playbackStartTime = 0;

    // Release MSAB mutex
    if (socket.value) {
      emitAsync<AudioPlayerStopPayload, AudioPlayerResponse>(
        'audioPlayer:stop',
        { roomId },
      ).catch((err) => {});
    }

    // Reset state
    playerState.status = 'stopped';
    playerState.userId = null;
    playerState.title = null;
    playerState.duration = 0;
    playerState.position = 0;

    // Close AudioContext to free resources
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close();
      audioContext = null;
    }

  }

  /**
   * Set playback volume (0-1). Adjusts the GainNode in the audio graph.
   */
  function setVolume(volume: number): void {
    if (!gainNode) return;
    gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  // ========================================
  // Socket Event Listeners
  // ========================================

  /**
   * Initialize socket listeners for audio player state broadcasts.
   * Call this after socket connection is established.
   */
  function setupListeners(): void {
    if (!socket.value) return;

    socket.value.on('audioPlayer:stateChanged', (event: AudioPlayerStateChangedEvent) => {
      const authStore = useAuthStore();
      // Don't update local state from own broadcast (we already have local state)
      if (event.userId === authStore.user?.id) return;

      switch (event.state) {
        case 'playing':
          playerState.status = 'playing';
          playerState.userId = event.userId;
          playerState.title = event.title ?? null;
          playerState.duration = event.duration ?? 0;
          playerState.position = event.position;
          break;
        case 'paused':
          playerState.status = 'paused';
          playerState.position = event.position;
          break;
        case 'stopped':
          playerState.status = 'idle';
          playerState.userId = null;
          playerState.title = null;
          playerState.duration = 0;
          playerState.position = 0;
          break;
      }
    });
  }

  /**
   * Remove socket listeners.
   */
  function cleanupListeners(): void {
    if (!socket.value) return;
    socket.value.off('audioPlayer:stateChanged');
  }

  /**
   * Initialize from room:join ack payload.
   * If music was already playing when user joined, sync UI state.
   */
  function initFromJoinState(musicPlayer: MusicPlayerJoinState | null): void {
    if (!musicPlayer) return;

    playerState.status = musicPlayer.isPaused ? 'paused' : 'playing';
    playerState.userId = musicPlayer.userId;
    playerState.title = musicPlayer.title;
    playerState.duration = musicPlayer.duration;
    playerState.position = musicPlayer.position;

  }

  /**
   * Full cleanup — stops playback, removes listeners, resets state.
   */
  function cleanup(roomId?: string): void {
    if (roomId && (playerState.status === 'playing' || playerState.status === 'paused')) {
      stop(roomId);
    }
    cleanupListeners();
    playerState.status = 'idle';
    playerState.userId = null;
    playerState.title = null;
    playerState.duration = 0;
    playerState.position = 0;
    audioBuffer = null;
  }

  // ========================================
  // Return
  // ========================================
  return {
    // State (reactive)
    playerState: readonly(playerState),

    // Computed
    isPlaying,
    isPaused,
    isActive,
    isMusicPlayingInRoom,

    // File loading
    loadFile,

    // Playback controls (return track for producer)
    play,
    pause,
    resume,
    seek,
    stop,
    setVolume,

    // Socket integration
    setupListeners,
    cleanupListeners,
    initFromJoinState,
    cleanup,
  };
}
