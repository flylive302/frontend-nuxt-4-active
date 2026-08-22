import type { types as mediasoupTypes } from 'mediasoup-client';
import type {
  AudioConsumeResponse,
  ConsumerResumeResponse,
  ProducerSource,
} from '~/types/room/audio';
import type { AudioSocket } from '../room/useAudioSocket';
import { useMediasoupDevice } from './useMediasoupDevice';
import { useMediasoupTransports } from './useMediasoupTransports';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';
import { storeToRefs } from 'pinia';
import { watch } from 'vue';
import { useMediasoupSessionStore } from '~/stores/mediasoupSession';
import { useAudioPreferencesStore } from '~/stores/audioPreferences';
import { resolveNoiseFilter, isAudioWorkletSupported } from '~/utils/audio/resolve-noise-filter';
import { classifyDeviceClass, readDeviceCapabilities } from '~/utils/device-class';
import { attachNoiseFilter, detachNoiseFilter } from './useMicNoiseFilter';

/** Module-scoped: the noise-filter preference watcher is installed once per page. */
let _noiseFilterWatcherInstalled = false;

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

// ---- Single-flight guards (audio-pipe-observability/15) ----
// `startAudio()` and `consumeProducer()` both check a "do I already have one?"
// map and only write the answer several awaits later. Two callers that pass the
// check together both build a producer / consumer, and the second write
// overwrites the first — orphaning a live, unreachable stream that keeps
// playing. Heard as doubled or echoed voice until the page is reloaded.
//
// These live at module scope because the state they guard is a singleton: the
// mediasoup session store and `producerTransport` are shared by every
// `useMediasoupStreaming()` instance, so per-instance guards would not see each
// other.
//
// 🔴 Concurrent callers await the SAME promise rather than early-returning. An
// early return would convert doubling into silence: if the first call then
// failed, the second caller would have skipped the work believing it was
// handled, and that producer would never be heard at all. Sharing the promise
// propagates the rejection to every caller, so their existing catch-and-retry
// paths still run.
let _startAudioInFlight: Promise<void> | null = null;
const _consumeInFlight = new Map<string, Promise<void>>();

// ---- Displacement-key guard (aws-app-affinity/14) ----
// `_consumeInFlight` above is keyed on `producerId`, which only covers the SAME
// producer arriving twice. It cannot see the other collision: a user's stale and
// fresh mic producers have DIFFERENT producerIds but the same displacement key,
// so both pass every guard above, both read an empty slot at the displacement
// check, and neither stops the other — the same audible doubling, through a door
// the producerId map does not watch.
//
// Reachable because the live `audio:newProducer` handler is registered
// (`useRoomAudio.ts:512`) before the join-time catch-up loop runs (`:731`), and
// MSAB delivers a producer through both paths by design.
//
// 🔴 This map holds a build keyed on `${userId}:${source}`, and a caller sharing
// that key WAITS for it rather than skipping — waiting preserves the serial
// loop's semantics (build, register, then get displaced by the newer one),
// whereas skipping would leave the newer producer unheard.
const _consumeInFlightByKey = new Map<string, Promise<void>>();

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
  const { producer, musicProducer, consumers, isLocalMuted, currentVolume, audioElements, consumerProducerByKey } = storeToRefs(session);

  const audioPreferences = useAudioPreferencesStore();

  /** Whether the RNNoise filter is wired into the live mic graph right now. */
  const isNoiseFilterActive = ref(false);

  // ========================================
  // Computed Properties
  // ========================================
  const isProducing = computed(() => producer.value !== null && !producer.value.closed);

  // Live toggle: if the user flips the noise-filter preference while already
  // producing, rebuild the mic pipeline so the change takes effect without
  // requiring a leave/rejoin. Registered ONCE per page (module flag): this
  // composable is instantiated from several callers (useMediasoup,
  // useRoomAudioPlayer, …) and a per-instance watcher would fire N
  // concurrent restartAudio() calls for one toggle. Only restarts when the
  // *effective* state changes — on a low-tier phone auto→off is a no-op.
  if (!_noiseFilterWatcherInstalled) {
    _noiseFilterWatcherInstalled = true;
    watch(() => resolveEffectiveNoiseFilter(), (next, prev) => {
      if (next === prev) return;
      if (producer.value && !producer.value.closed) {
        restartAudio();
      }
    });
  }

  /** GATE: the effective RNNoise decision for the current preference + device. */
  function resolveEffectiveNoiseFilter(): boolean {
    return resolveNoiseFilter(
      audioPreferences.noiseFilterMode,
      classifyDeviceClass(readDeviceCapabilities()),
      isAudioWorkletSupported(),
    );
  }

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

    // audio-pipe-observability/15: `producer.value` is not written until
    // `produceMicTrack()` finishes, and that spans `getUserMedia()` — which on
    // first grant sits on a permission prompt for seconds. Three unserialised
    // callers reach here (take-seat, accept-invite, seat-reclaim after a
    // reconnect), so the guard above cannot stand alone. Join the produce
    // already running instead of starting a second one; MSAB does not close the
    // producer a second produce displaces, so both would stay audible.
    if (_startAudioInFlight) {
      return _startAudioInFlight;
    }

    _startAudioInFlight = produceMicTrack();
    try {
      await _startAudioInFlight;
    }
    finally {
      _startAudioInFlight = null;
    }
  }

  /**
   * EXECUTE half of `startAudio()` — acquire the mic and produce it.
   *
   * Split out so the single-flight guard has something to hold a promise to.
   * ⛔ Call `startAudio()`, never this: on its own it has no concurrency guard.
   */
  async function produceMicTrack(): Promise<void> {
    if (!producerTransport.value) {
      await createProducerTransport();
    }

    // RNNoise replaces the browser's built-in noiseSuppression when it's
    // active — running both would double-process the signal. AEC/AGC stay on
    // either way; only the browser DSP noise suppressor is swapped out.
    const rnnoiseActive = resolveEffectiveNoiseFilter();
    isNoiseFilterActive.value = rnnoiseActive;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: !rnnoiseActive,
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

    const trackForProducer = await wireMicThroughAudioContext(stream, rnnoiseActive);

    // Voice mic: mono at a capped 96k target (64k until 2026-08-23; raised
    // after the "A vs A++" audio-quality review). Without these options the
    // router's stereo-forced Opus config encodes the mono mic as uncapped
    // stereo — roughly half the bits go to a phantom second channel and BWE
    // picks an arbitrary rate ("weak audio", 2026-07-10 audio review). FEC on
    // for loss resilience; DTX stays off (it froze the HLS broadcast mix).
    // Server maxIncomingBitrate (256k) covers mic 96k + DJ music 128k + FEC.
    producer.value = await producerTransport.value!.produce({
      track: trackForProducer,
      codecOptions: {
        opusStereo: false,
        opusFec: true,
        opusDtx: false,
        opusMaxAverageBitrate: 96000,
      },
      appData: { source: 'mic' },
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
  async function wireMicThroughAudioContext(stream: MediaStream, useNoiseFilter: boolean): Promise<MediaStreamTrack> {
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

    const ctx = new Ctor({ sampleRate: 48000 });
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    const destination = ctx.createMediaStreamDestination();

    // RNNoise sits between the raw source and the gain stage. Any attach
    // failure (unsupported browser, module load error) falls back to the
    // source itself — same passthrough graph as before this filter existed.
    let upstream: AudioNode = source;
    if (useNoiseFilter) {
      upstream = await attachNoiseFilter(ctx, source);
      isNoiseFilterActive.value = upstream !== source;
    }
    upstream.connect(gain);
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
    detachNoiseFilter();
    isNoiseFilterActive.value = false;

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
    // (256k) covers it alongside the DJ's own 96k mic on the same transport.
    musicProducer.value = await producerTransport.value.produce({
      track,
      codecOptions: {
        opusStereo: true,
        opusFec: true,
        opusDtx: false,
        opusMaxAverageBitrate: 128000,
      },
      appData: { source: 'music' },
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
   * True when the mic producing pipeline can no longer carry audio and only a
   * full rebuild (`restartAudio`) will fix it: producer/transport closed or
   * ICE-dead, or the OS killed/muted the raw `getUserMedia` track while the
   * producer's AudioContext destination track still looks "live" (the long-mute
   * failure mode — re-enabling the track would feed silence).
   */
  function isMicPipelineDead(): boolean {
    if (!producer.value || producer.value.closed) return true;
    if (producer.value.track?.readyState === 'ended') return true;

    const transport = producerTransport.value;
    if (!transport || transport.closed) return true;
    const state = transport.connectionState;
    if (state === 'failed' || state === 'disconnected' || state === 'closed') return true;

    if (_micRawTrack && (_micRawTrack.muted || _micRawTrack.readyState === 'ended')) return true;
    if (_micAudioContext && _micAudioContext.state === 'closed') return true;

    return false;
  }

  /**
   * Tear down and rebuild the whole mic producing path: producer, AudioContext
   * graph, raw mic, and — when it is dead — the producer transport itself.
   * Equivalent to leaving and retaking the seat, without touching the seat.
   */
  async function restartAudio(): Promise<void> {
    stopAudio();

    const transport = producerTransport.value;
    if (
      transport
      && (transport.closed
        || transport.connectionState === 'failed'
        || transport.connectionState === 'disconnected'
        || transport.connectionState === 'closed')
    ) {
      transport.close();
      producerTransport.value = null;
    }

    await startAudio();
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
   * Reconcile the current producer's track to the existing mute flag WITHOUT
   * flipping it (audio-pipe-observability 12). A re-produce (seat-reclaim rejoin)
   * mints a fresh, enabled getUserMedia track; if the user was muted, that track
   * would go live while the UI still shows muted — a hot mic. Call this right
   * after such a re-produce to disable the fresh track when `isLocalMuted`.
   * Distinct from `toggleLocalMute`, which changes the mute state.
   */
  function reapplyMuteToProducer(): void {
    const track = producer.value?.track;
    if (track) {
      track.enabled = !isLocalMuted.value;
    }
  }

  /**
   * Consume audio from a remote producer.
   *
   * @param producerId - ID of the remote producer to consume
   * @param roomId - Room ID for the consume request
   * @param producerUserId - owning user id, used for the per-source displacement key
   * @param source - producer purpose tag; a producer announced without one
   *   (pre-feature server/peer) is treated as `'mic'` (compat)
   */
  async function consumeProducer(
    producerId: string,
    roomId: string,
    producerUserId?: number,
    source: ProducerSource = 'mic',
  ): Promise<void> {
    const authStore = useAuthStore();
    if (producerUserId !== undefined && producerUserId === authStore.user?.id) {
      return;
    }

    // observability-audio-quality 13: the single funnel every remote producer
    // announcement passes through — both the join-time catch-up loop over
    // `existingProducers` and the live `audio:newProducer` event call this.
    //
    // 🔴 Counted HERE, above the readiness gate, on purpose. Every early return
    // below is a way for an announced producer to never become audio, and five
    // of the six are silent — no log, no telemetry. Counting after the gate
    // would make the readiness case invisible to the very detector that exists
    // to find it. Counted after the self-check, because our own producer was
    // never something to hear.
    session.noteProducerAnnounced();

    if (!device.value?.loaded || !consumerTransport.value) {
      return;
    }

    // Composite key: a user's mic and music producers are tracked
    // independently, so a fresh mic producer only displaces the stale mic
    // consumer (never touches that user's music consumer), and vice versa.
    const trackingKey = producerUserId !== undefined ? `${producerUserId}:${source}` : undefined;

    // audio-pipe-observability/15: the `consumers` check below is the ONLY
    // dedup gate, and the map it reads is not written until `buildConsumer()`
    // returns — two awaits later. MSAB can deliver the same producer twice: it
    // is visible to a joiner's `existingProducers` snapshot from the moment
    // `audio:produce` tracks it, but the `audio:newProducer` broadcast fires two
    // awaits later, by which time that joiner has already joined the socket
    // room. Both deliveries reach here concurrently, both pass, and the second
    // `addConsumer` orphans the first consumer and its `<audio>` element —
    // still playing, no longer reachable by `stopConsumer()`. Reproduces on
    // every reconnect, since `room:join` replays the whole snapshot.
    //
    // 🔴 This guard stays FIRST, above the displacement-key wait below. Sharing
    // the same promise is what propagates a rejection to every caller for this
    // producer; route them through the key wait instead and a failed first call
    // would let the second one quietly succeed on its own, breaking the
    // "surfaces a failure to the joining caller too" contract.
    const inFlight = _consumeInFlight.get(producerId);
    if (inFlight) {
      return inFlight;
    }

    // Check if already consuming
    if (consumers.value.has(producerId)) {
      return;
    }

    // aws-app-affinity/14: a DIFFERENT producer sharing this displacement key
    // may be mid-build. Wait it out so the displacement read below observes its
    // registration and correctly stops it — otherwise both survive and the
    // speaker is heard twice.
    //
    // Loops rather than awaiting once: several callers can be parked on the
    // same build, and they resume in registration order, so each must re-read
    // the tail and follow whoever claimed the key next. Terminates because a
    // build always clears its own entry in `finally`, so the map drains.
    if (trackingKey !== undefined) {
      let keyInFlight = _consumeInFlightByKey.get(trackingKey);
      while (keyInFlight) {
        // Swallowed on purpose: the other producer's failure is its caller's to
        // surface, and it must not stop us restoring THIS speaker.
        await keyInFlight.catch(() => {});

        // The world moved while we waited — re-run the producerId guards.
        const nowInFlight = _consumeInFlight.get(producerId);
        if (nowInFlight) {
          return nowInFlight;
        }
        if (consumers.value.has(producerId)) {
          return;
        }

        const next = _consumeInFlightByKey.get(trackingKey);
        keyInFlight = next === keyInFlight ? undefined : next;
      }
    }

    if (trackingKey !== undefined) {
      const existingProducerId = consumerProducerByKey.value.get(trackingKey);
      if (existingProducerId && existingProducerId !== producerId) {
        stopConsumer(existingProducerId);
      }
    }

    const build = buildConsumer(producerId, roomId, trackingKey);
    _consumeInFlight.set(producerId, build);
    if (trackingKey !== undefined) {
      _consumeInFlightByKey.set(trackingKey, build);
    }
    try {
      await build;
    }
    finally {
      _consumeInFlight.delete(producerId);
      // Only clear the key if we still own it — a later caller may already have
      // claimed it, and deleting theirs would reopen the race we just closed.
      if (trackingKey !== undefined && _consumeInFlightByKey.get(trackingKey) === build) {
        _consumeInFlightByKey.delete(trackingKey);
      }
    }
  }

  /**
   * EXECUTE half of `consumeProducer()` — build, resume and attach one consumer.
   *
   * Split out so the single-flight guard has something to hold a promise to.
   * ⛔ Call `consumeProducer()`, never this: on its own it has no concurrency
   * guard, and it skips the announcement counter ticket 13 depends on.
   */
  async function buildConsumer(
    producerId: string,
    roomId: string,
    trackingKey: string | undefined,
  ): Promise<void> {
    if (!consumerTransport.value || !device.value) {
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

    // Re-GATE after the await: the transport was validated at entry, but
    // `audio:consume` is a network round-trip and a room leave or reconnect
    // rebuild runs `cleanup()`, which nulls `consumerTransport`. Without this
    // the next line derefs null.
    if (!consumerTransport.value) {
      log.warn('Consumer transport torn down while audio:consume was in flight', { producerId });
      return;
    }

    const consumer = await consumerTransport.value.consume({
      id: response.data.id,
      producerId: response.data.producerId,
      kind: response.data.kind,
      rtpParameters: response.data.rtpParameters,
    });

    session.addConsumer(producerId, consumer);
    if (trackingKey !== undefined) {
      consumerProducerByKey.value.set(trackingKey, producerId);
    }

    // Resume the consumer (consumers start paused). On timeout/disconnect the
    // half-built consumer must not linger: it would block a clean re-consume
    // (the `already consuming` guard above) while never producing audio.
    let resumeResponse: ConsumerResumeResponse;
    try {
      resumeResponse = await emitAsync<object, ConsumerResumeResponse>('consumer:resume', {
        roomId,
        consumerId: consumer.id,
      });
    } catch (err) {
      stopConsumer(producerId);
      throw err;
    }

    if (!resumeResponse.success) {
      stopConsumer(producerId);
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
      for (const [key, trackedProducerId] of consumerProducerByKey.value) {
        if (trackedProducerId === producerId) {
          consumerProducerByKey.value.delete(key);
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

    for (const [key, trackedProducerId] of consumerProducerByKey.value) {
      if (trackedProducerId === producerId) {
        consumerProducerByKey.value.delete(key);
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
    // audio-pipe-observability/15: the single-flight guards are module scope, so
    // they outlive the room. Released here because a produce that never settles
    // — a mic permission prompt the user simply ignores — would otherwise lock
    // every later room out of producing for the rest of the page's life. The
    // work they guard is not cancelled, but it is about to fail anyway: the
    // transports it needs are closed below.
    _startAudioInFlight = null;
    _consumeInFlight.clear();
    // aws-app-affinity/14: same reasoning, and it matters more here — a waiter
    // parked on a build that can no longer settle would hold up every later
    // consume for that speaker. Clearing only stops NEW callers from parking;
    // anyone already waiting is released when the build it holds rejects
    // against the transports closed below.
    _consumeInFlightByKey.clear();

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
    isNoiseFilterActive,
    startAudio,
    stopAudio,
    restartAudio,
    isMicPipelineDead,
    produceTrack,
    stopMusicProducer,
    toggleLocalMute,
    reapplyMuteToProducer,
    consumeProducer,
    stopConsumer,
    cleanup,
    recoverPlayback,
    probeAudioHealth,
    setVolume,
    getVolume,
  };
}
