import type { types as mediasoupTypes } from 'mediasoup-client';
import type {
  AudioConsumeResponse,
  ConsumerResumeResponse,
} from '~/types/room/audio';
import type { AudioSocket } from '../room/useAudioSocket';
import { useMediasoupDevice } from './useMediasoupDevice';
import { useMediasoupTransports } from './useMediasoupTransports';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';
import { storeToRefs } from 'pinia';
import { useMediasoupSessionStore } from '~/stores/mediasoupSession';

// ---- Mic capture pipeline (Web Audio passthrough) ----
// We route the raw getUserMedia track through an AudioContext graph before
// handing the resulting track to mediasoup. This is the standard fix for
// Android Chrome / TWA pausing microphone capture in the background when no
// local AudioContext is consuming the track (F-26).
let _micStream: MediaStream | null = null;
let _micRawTrack: MediaStreamTrack | null = null;
let _micAudioContext: AudioContext | null = null;
let _micSourceNode: MediaStreamAudioSourceNode | null = null;
let _micGainNode: GainNode | null = null;
let _micDestinationNode: MediaStreamAudioDestinationNode | null = null;
let _micVisibilityHandler: (() => void) | null = null;

const REMOTE_AUDIO_CONTAINER_ID = 'flylive-remote-audio';

function getRemoteAudioContainer(): HTMLElement | null {
  if (!import.meta.client) return null;

  let container = document.getElementById(REMOTE_AUDIO_CONTAINER_ID);
  if (container) return container;

  container = document.createElement('div');
  container.id = REMOTE_AUDIO_CONTAINER_ID;
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.width = '1px';
  container.style.height = '1px';
  container.style.overflow = 'hidden';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  return container;
}

function attachAudioElement(audio: HTMLAudioElement): void {
  audio.autoplay = true;
  audio.setAttribute('playsinline', 'true');

  const container = getRemoteAudioContainer();
  if (container && audio.parentElement !== container) {
    container.appendChild(audio);
  }
}

// ============================================
// Composable
// ============================================

/**
 * Mediasoup Audio Streaming
 *
 * Handles audio production (microphone) and consumption (remote speakers).
 * Requires device and transports to be initialized first.
 */
export function useMediasoupStreaming(socket: Ref<AudioSocket | null>) {
  const log = createLogger('[MediasoupStreaming]');
  const emitAsync = createEmitAsync(socket);

  // Get device and transports from other composables
  const { device } = useMediasoupDevice();
  const { producerTransport, consumerTransport, createProducerTransport } = useMediasoupTransports(socket);

  // Reactive session state lives in the store
  const session = useMediasoupSessionStore();
  const { producer, musicProducer, consumers, isLocalMuted, currentVolume, audioElements, consumerProducerByUserId } = storeToRefs(session);

  // ========================================
  // Computed Properties
  // ========================================
  const isProducing = computed(() => producer.value !== null && !producer.value.closed);

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Start producing audio from the microphone.
   *
   * Pipeline: `getUserMedia` → `AudioContext.createMediaStreamSource` →
   * `GainNode` → `MediaStreamAudioDestinationNode` → `producerTransport.produce`.
   *
   * The local AudioContext acts as a live consumer of the mic stream so the
   * browser keeps the capture pipeline active when the page is backgrounded.
   * Without it, Android Chrome / TWA pauses the underlying mic input after
   * ~2-3 seconds in the background, causing other users to hear the speaker
   * cut out (F-26). AEC, noise suppression, and AGC are still applied by
   * `getUserMedia` BEFORE the AudioContext sees the stream, so audio quality
   * is unchanged.
   */
  async function startAudio(): Promise<void> {
    if (producer.value && !producer.value.closed) {
      return;
    }

    if (!producerTransport.value) {
      await createProducerTransport();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const rawTrack = stream.getAudioTracks()[0];
    if (!rawTrack) {
      throw new Error('getUserMedia returned no audio track');
    }

    _micStream = stream;
    _micRawTrack = rawTrack;

    rawTrack.addEventListener('mute', () => {
    });
    rawTrack.addEventListener('unmute', () => {
    });
    rawTrack.addEventListener('ended', () => {
    });

    const trackForProducer = wireMicThroughAudioContext(stream);

    // Voice mic: mono at a capped 64k target. Without these options the
    // router's stereo-forced Opus config encodes the mono mic as uncapped
    // stereo — roughly half the bits go to a phantom second channel and BWE
    // picks an arbitrary rate ("weak audio", 2026-07-10 audio review). FEC on
    // for loss resilience; DTX stays off (it froze the HLS broadcast mix).
    producer.value = await producerTransport.value!.produce({
      track: trackForProducer,
      codecOptions: {
        opusStereo: false,
        opusFec: true,
        opusDtx: false,
        opusMaxAverageBitrate: 64000,
      },
    });

    producer.value.on('transportclose', () => {
      producer.value = null;
    });

    producer.value.on('trackended', () => {
      stopAudio();
    });

  }

  /**
   * Build (or rebuild) the AudioContext passthrough graph for the mic.
   * Returns the track that should be handed to mediasoup. See `startAudio()`
   * doc for why this exists.
   */
  function wireMicThroughAudioContext(stream: MediaStream): MediaStreamTrack {
    if (!import.meta.client) {
      const fallback = stream.getAudioTracks()[0];
      if (!fallback) throw new Error('No audio track');
      return fallback;
    }

    const Ctor = (window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) {
      const fallback = stream.getAudioTracks()[0];
      if (!fallback) throw new Error('No audio track');
      return fallback;
    }

    teardownMicAudioContext();

    const ctx = new Ctor();
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    const destination = ctx.createMediaStreamDestination();
    source.connect(gain);
    gain.connect(destination);

    _micAudioContext = ctx;
    _micSourceNode = source;
    _micGainNode = gain;
    _micDestinationNode = destination;

    if (ctx.state === 'suspended') {
      ctx.resume().catch((err) => {
        log.warn('Failed to resume AudioContext', err)
      });
    }

    const visibilityHandler = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState !== 'visible') return;
      const current = _micAudioContext;
      if (!current) return;
      if (current.state === 'suspended') {
        current.resume().catch((err) => {
          log.warn('Failed to resume AudioContext on visibility change', err)
        });
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', visibilityHandler);
      _micVisibilityHandler = visibilityHandler;
    }

    const producedTrack = destination.stream.getAudioTracks()[0];
    if (!producedTrack) {
      throw new Error('MediaStreamDestination produced no audio track');
    }
    return producedTrack;
  }

  /** Tear down the mic AudioContext graph. Safe to call when nothing is set up. */
  function teardownMicAudioContext(): void {
    if (_micVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', _micVisibilityHandler);
    }
    _micVisibilityHandler = null;

    try { _micSourceNode?.disconnect(); } catch { /* noop */ }
    try { _micGainNode?.disconnect(); } catch { /* noop */ }
    try { _micDestinationNode?.disconnect(); } catch { /* noop */ }
    _micSourceNode = null;
    _micGainNode = null;
    _micDestinationNode = null;

    const ctx = _micAudioContext;
    _micAudioContext = null;
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch((err) => { log.warn('Failed to close AudioContext', err) });
    }
  }

  /** Stop the raw mic capture and release the device. */
  function teardownMicStream(): void {
    if (_micStream) {
      _micStream.getTracks().forEach((track) => {
        try { track.stop(); } catch { /* noop */ }
      });
    }
    _micStream = null;
    _micRawTrack = null;
  }

  /**
   * Stop producing audio and close the producer.
   *
   * Also tears down the mic AudioContext graph and releases the raw mic
   * device. Otherwise the mic light stays on after the user leaves the seat,
   * the AudioContext leaks, and on next start we'd stack a second pipeline.
   */
  function stopAudio(): void {
    if (producer.value) {
      producer.value.close();
      producer.value = null;
      isLocalMuted.value = false;
    }
    teardownMicAudioContext();
    teardownMicStream();
  }

  /**
   * Produce the DJ's music track (the audio playback engine's stable output
   * track). Creates producer transport if needed. Stores in musicProducer.
   *
   * Idempotent and produced **exactly once per DJ session**: the engine swaps
   * only its upstream `AudioBufferSourceNode` on track change, so the output
   * `MediaStreamTrack` identity is stable. We must NOT close/recreate the
   * producer on a track boundary (that would cause a signaling storm and an
   * audible gap). Closing it on Stop / disconnect / `revoked` is handled by
   * `stopMusicProducer()` / `cleanup()` (and later slices).
   *
   * @param track - The engine's stable output MediaStreamTrack
   */
  async function produceTrack(track: MediaStreamTrack): Promise<void> {
    // Already producing the session's music track — keep it alive across swaps.
    if (musicProducer.value && !musicProducer.value.closed) {
      return;
    }

    // Create producer transport if needed
    if (!producerTransport.value) {
      await createProducerTransport();
    }

    if (!producerTransport.value) {
      return;
    }

    // Music (DJ) producer: true stereo source, higher cap than the voice mic.
    // 128k stereo Opus is transparent for music; server maxIncomingBitrate
    // (192k) leaves headroom for FEC/overhead.
    musicProducer.value = await producerTransport.value.produce({
      track,
      codecOptions: {
        opusStereo: true,
        opusFec: true,
        opusDtx: false,
        opusMaxAverageBitrate: 128000,
      },
    });

    musicProducer.value.on('transportclose', () => {
      musicProducer.value = null;
    });

    musicProducer.value.on('trackended', () => {
      stopMusicProducer();
    });

  }

  /**
   * Stop producing the music track and close the music producer.
   */
  function stopMusicProducer(): void {
    if (musicProducer.value) {
      musicProducer.value.close();
      musicProducer.value = null;
    }
  }

  /**
   * Toggle local microphone mute (pauses/resumes the track, not the producer).
   * This mutes locally - other users won't hear audio until unmuted.
   */
  function toggleLocalMute(): boolean {
    if (!producer.value) {
      return isLocalMuted.value;
    }

    const track = producer.value.track;
    if (track) {
      isLocalMuted.value = !isLocalMuted.value;
      track.enabled = !isLocalMuted.value;
    }

    return isLocalMuted.value;
  }

  /**
   * Consume audio from a remote producer.
   *
   * @param producerId - ID of the remote producer to consume
   * @param roomId - Room ID for the consume request
   */
  async function consumeProducer(producerId: string, roomId: string, producerUserId?: number): Promise<void> {
    if (!device.value?.loaded || !consumerTransport.value) {
      return;
    }

    const authStore = useAuthStore();
    if (producerUserId !== undefined && producerUserId === authStore.user?.id) {
      return;
    }

    if (producerUserId !== undefined) {
      const existingProducerId = consumerProducerByUserId.value.get(producerUserId);
      if (existingProducerId && existingProducerId !== producerId) {
        stopConsumer(existingProducerId);
      }
    }

    // Check if already consuming
    if (consumers.value.has(producerId)) {
      return;
    }

    const response = await emitAsync<object, AudioConsumeResponse>('audio:consume', {
      roomId,
      transportId: consumerTransport.value.id,
      producerId,
      rtpCapabilities: device.value.rtpCapabilities,
    });

    if (!response.success || !response.data) {
      return;
    }

    const consumer = await consumerTransport.value.consume({
      id: response.data.id,
      producerId: response.data.producerId,
      kind: response.data.kind,
      rtpParameters: response.data.rtpParameters,
    });

    session.addConsumer(producerId, consumer);
    if (producerUserId !== undefined) {
      consumerProducerByUserId.value.set(producerUserId, producerId);
    }

    // Resume the consumer (consumers start paused)
    const resumeResponse = await emitAsync<object, ConsumerResumeResponse>('consumer:resume', {
      roomId,
      consumerId: consumer.id,
    });

    if (!resumeResponse.success) {
      return;
    }

    // Attach to audio element (tracked for cleanup)
    const audio = new Audio();
    audio.srcObject = new MediaStream([consumer.track]);
    audio.volume = currentVolume.value;
    attachAudioElement(audio);
    audioElements.value.set(producerId, audio);

    // Try to play, handling autoplay policy
    const playAudio = async () => {
      try {
        await audio.play();
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          // Autoplay blocked - wait for user interaction

          // Add a one-time click listener to resume playback
          const resumePlayback = async () => {
            try {
              await audio.play();
            } catch (e) {
              log.warn('Failed to play audio after user interaction', e)
            }
            document.removeEventListener('click', resumePlayback);
            document.removeEventListener('touchstart', resumePlayback);
          };

          document.addEventListener('click', resumePlayback, { once: true });
          document.addEventListener('touchstart', resumePlayback, { once: true });
        } else {
          log.warn('Failed to play audio', err)
        }
      }
    };

    playAudio();

    consumer.on('transportclose', () => {
      session.removeConsumer(producerId);
      for (const [userId, trackedProducerId] of consumerProducerByUserId.value) {
        if (trackedProducerId === producerId) {
          consumerProducerByUserId.value.delete(userId);
        }
      }
      const closedAudio = audioElements.value.get(producerId);
      if (closedAudio) {
        closedAudio.pause();
        closedAudio.srcObject = null;
        closedAudio.remove();
        audioElements.value.delete(producerId);
      }
    });

  }

  /**
   * Stop consuming from a specific producer.
   *
   * @param producerId - ID of the producer to stop consuming
   */
  function stopConsumer(producerId: string): void {
    const consumer = consumers.value.get(producerId);
    if (consumer) {
      consumer.close();
      session.removeConsumer(producerId);
    }

    for (const [userId, trackedProducerId] of consumerProducerByUserId.value) {
      if (trackedProducerId === producerId) {
        consumerProducerByUserId.value.delete(userId);
      }
    }

    // Clean up associated audio element
    const audio = audioElements.value.get(producerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      audioElements.value.delete(producerId);
    }

  }

  /**
   * Close all mediasoup producers and consumers.
   * State clearing (Maps, primitives) is handled by useMediasoupSessionStore.$reset()
   * which is called from leaveRoom().
   */
  function cleanup(): void {
    // Close producer
    stopAudio();

    // Close music producer
    stopMusicProducer();

    // Close all consumers via mediasoup API
    consumers.value.forEach((consumer) => consumer.close());
  }

  /**
   * Probe the audio session for health after a PWA/TWA foreground resume.
   *
   * Returns one of three outcomes so the lifecycle layer can decide what to do
   * without tearing down a healthy session (which is what triggers MSAB's
   * seat-grace timer and the self-retake `seat:cleared` race):
   *
   *  - `healthy`: socket connected, transports alive, producer/consumers live,
   *    audio elements playing and advancing.
   *  - `needs-playback-recovery`: socket/transports/consumers alive, but one or
   *    more HTMLAudioElements are paused/stalled. `recoverPlayback()` is enough.
   *  - `needs-rebuild`: socket dead, a transport failed/closed, producer or any
   *    consumer track ended. Full rejoin path required.
   */
  async function probeAudioHealth(): Promise<'healthy' | 'needs-playback-recovery' | 'needs-rebuild'> {
    if (!import.meta.client) return 'healthy';

    if (!socket.value?.connected) {
      return 'needs-rebuild';
    }

    const transports: Array<[string, mediasoupTypes.Transport | null]> = [
      ['producer', producerTransport.value],
      ['consumer', consumerTransport.value],
    ];
    for (const [, transport] of transports) {
      if (!transport) continue;
      if (transport.closed) {
        return 'needs-rebuild';
      }
      const state = transport.connectionState;
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        return 'needs-rebuild';
      }
    }

    if (producer.value) {
      if (producer.value.closed) {
        return 'needs-rebuild';
      }
      if (producer.value.track && producer.value.track.readyState === 'ended') {
        return 'needs-rebuild';
      }
      // F-26: the OS may have muted the raw mic during background. The producer
      // track itself (AudioContext destination) does not surface this — the
      // signal is on the raw `getUserMedia` track. If we detect it here, mark
      // the session as rebuild-required so the lifecycle layer reacquires
      // the mic from scratch.
      if (_micRawTrack && _micRawTrack.muted) {
        return 'needs-rebuild';
      }
      if (_micRawTrack && _micRawTrack.readyState === 'ended') {
        return 'needs-rebuild';
      }
      if (_micAudioContext && _micAudioContext.state === 'closed') {
        return 'needs-rebuild';
      }
    }

    for (const [, consumer] of consumers.value) {
      if (consumer.closed || consumer.track.readyState === 'ended') {
        return 'needs-rebuild';
      }
    }

    let pausedOrUnready = false;
    for (const [, audio] of audioElements.value) {
      if (audio.paused || audio.readyState < 2) {
        pausedOrUnready = true;
        break;
      }
    }
    if (pausedOrUnready) return 'needs-playback-recovery';

    if (audioElements.value.size > 0) {
      const before = new Map<string, number>();
      for (const [producerId, audio] of audioElements.value) {
        before.set(producerId, audio.currentTime);
      }
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      for (const [producerId, audio] of audioElements.value) {
        const prev = before.get(producerId) ?? 0;
        if (!audio.paused && audio.currentTime === prev) {
          return 'needs-playback-recovery';
        }
      }
    }

    return 'healthy';
  }

  /**
   * Recover remote playback after mobile/PWA background suspension.
   * Socket.IO may recover while WebRTC audio elements remain paused/stalled.
   */
  async function recoverPlayback(): Promise<boolean> {
    if (audioElements.value.size === 0) return true;

    let recovered = true;

    for (const [producerId, audio] of audioElements.value) {
      const consumer = consumers.value.get(producerId);

      if (!consumer || consumer.closed || consumer.track.readyState === 'ended') {
        recovered = false;
        continue;
      }

      attachAudioElement(audio);

      try {
        await audio.play();
      } catch (err) {
        log.warn('Failed to recover audio playback', err)
        recovered = false;
      }
    }

    return recovered;
  }

  /**
   * Set volume for all consumer audio elements.
   * Value is clamped between 0 and 1 by the store.
   *
   * @param volume - Volume level (0–1)
   */
  function setVolume(volume: number): void {
    session.setVolume(volume);

    audioElements.value.forEach((audio) => {
      audio.volume = currentVolume.value;
    });

  }

  /**
   * Get current volume level.
   * @returns Current volume (0–1)
   */
  function getVolume(): number {
    return currentVolume.value;
  }

  // ========================================
  // Return
  // ========================================
  return {
    producer,
    musicProducer,
    consumers,
    isProducing,
    isLocalMuted,
    currentVolume,
    startAudio,
    stopAudio,
    produceTrack,
    stopMusicProducer,
    toggleLocalMute,
    consumeProducer,
    stopConsumer,
    cleanup,
    recoverPlayback,
    probeAudioHealth,
    setVolume,
    getVolume,
  };
}
