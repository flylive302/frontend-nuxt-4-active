/**
 * Audio Playback Engine
 *
 * Framework-agnostic deep module that owns the raw Web Audio graph for the
 * Room music DJ session. Extracted from `useRoomAudioPlayer` so the orchestrator
 * (slice 04) can compose it with the Playlist queue model without touching any
 * Web Audio internals.
 *
 * Design (ADR 0006 memory model + PRD "seamless auto-advance"):
 *
 *   AudioBufferSourceNode  ──swappable──┐
 *                                        ▼
 *                          GainNode ──> MediaStreamAudioDestinationNode ──> output track
 *                                  └──> AudioContext.destination (DJ's local monitor)
 *
 * The `GainNode → MediaStreamAudioDestinationNode` graph and its output
 * `MediaStreamTrack` are built **once** per session. A track change swaps only
 * the upstream `AudioBufferSourceNode`, so the output track identity never
 * changes — the mediasoup `musicProducer` is produced once and listeners never
 * re-consume, giving a gapless boundary on auto-advance.
 *
 * The `GainNode → AudioContext.destination` edge is the DJ's **local monitor**
 * (the DJ hearing their own music out the loudspeaker). It is **permanently
 * connected** (ADR 0018) — the DJ always hears their own music, on loudspeaker,
 * headphones, or Bluetooth; the engine never decides for them.
 *
 * Memory: a decoded `AudioBuffer` is raw PCM (~80 MB per 3.5-min song), so the
 * engine keeps at most the current + the prefetched-next decoded buffer
 * resident and releases everything else (`releaseExcept`). The Playlist itself
 * holds only cheap `File` handles.
 *
 * No Vue reactivity, no Pinia stores, no sockets — that coupling lives in the
 * orchestrator. The engine reports position via `getPosition()`; the
 * orchestrator drives the reactive UI clock and the `stateUpdate` relay.
 */
import { createLogger } from '~/utils/logger';

const log = createLogger('[AudioEngine]');

/**
 * Raised when a file cannot be decoded (corrupt, unsupported codec, or too
 * large to fit in memory). Surfaced to the caller so the UI can show a clear,
 * specific reason (PRD story 14). The originating error is kept in `cause`.
 */
export class AudioPlaybackError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AudioPlaybackError';
    this.cause = cause;
  }
}

/** Engine-internal playback status (distinct from the reactive UI status). */
export type EnginePlaybackStatus = 'idle' | 'playing' | 'paused';

export interface AudioPlaybackEngine {
  /**
   * The stable output `MediaStreamTrack` for the whole DJ session. Produce it
   * via mediasoup exactly once; it never changes across track swaps.
   */
  getOutputTrack(): MediaStreamTrack;
  /**
   * Decode (on demand) and start playing the given track, swapping the source
   * on the persistent graph. Used for the first track and every auto-advance.
   * @returns the decoded duration in seconds.
   * @throws {AudioPlaybackError} if the file cannot be decoded.
   */
  play(id: string, file: File): Promise<{ duration: number }>;
  /**
   * Prefetch-decode the next track in the background so the boundary is gapless.
   * Fire-and-forget: failures are logged, not thrown (the real attempt to
   * `play()` it later surfaces the error to the user).
   */
  prefetch(id: string, file: File): void;
  /** Pause playback (suspends the context → output track sends silence). */
  pause(): Promise<void>;
  /** Resume from the paused position. */
  resume(): Promise<void>;
  /** Seek to `position` seconds within the current track (swaps the source). */
  seek(position: number): void;
  /** Set output volume 0–1. */
  setVolume(volume: number): void;
  /**
   * Talk-over duck (ADR 0018): ramp the master gain to `fraction` of the
   * current slider volume over `rampMs`, on the audio thread. Repeated calls
   * (rapid re-hold) simply re-anchor the ramp from the current live value —
   * they do not stack multiplicatively.
   */
  duck(fraction: number, rampMs: number): void;
  /**
   * Release a duck: ramp the master gain back to the slider volume (whatever
   * it is now — a `setVolume` call during the duck updates the restore
   * target) over `rampMs`. Safe to call when not ducked (no-op).
   */
  releaseDuck(rampMs: number): void;
  /** Current playback position in seconds. */
  getPosition(): number;
  /** Duration of the current track in seconds (0 if nothing loaded). */
  getDuration(): number;
  /** Engine-internal playback status. */
  getStatus(): EnginePlaybackStatus;
  /** Register the natural-end callback (fires only when a track ends on its own). */
  setOnEnded(cb: (() => void) | null): void;
  /**
   * Stop the current source without tearing down the graph or output track.
   * Keeps the AudioContext + `musicProducer` alive (e.g. end-of-queue).
   */
  stop(): void;
  /**
   * Full teardown: stop the source, disconnect the graph, close the
   * AudioContext, and release all decoded buffers. Called on Stop / disconnect /
   * `revoked` (the producer close is the orchestrator's job).
   */
  dispose(): void;
}

/**
 * Create a per-session audio playback engine. The orchestrator owns its
 * lifecycle: one engine per DJ session, disposed on Stop / disconnect / revoke.
 */
export function createAudioPlaybackEngine(): AudioPlaybackEngine {
  // ---- Persistent graph (built once, reused across track swaps) ----
  let audioContext: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let destinationNode: MediaStreamAudioDestinationNode | null = null;
  let lastVolume = 1;

  // ---- Talk-over duck (ADR 0018): multiplier over lastVolume, never persisted ----
  let isDucked = false;
  let duckFraction = 1;

  // ---- Swappable source (one per track / seek) ----
  let sourceNode: AudioBufferSourceNode | null = null;
  let sourceStarted = false;

  // ---- Decoded PCM cache: bounded to current + prefetched-next ----
  const decoded = new Map<string, AudioBuffer>();
  let currentId: string | null = null;
  let prefetchedId: string | null = null;

  // ---- Position bookkeeping ----
  let status: EnginePlaybackStatus = 'idle';
  let startTime = 0; // ctx.currentTime when the current source started
  let startOffset = 0; // seconds into the track at that start
  let currentDuration = 0;

  let onEnded: (() => void) | null = null;

  // ========================================
  // Graph lifecycle
  // ========================================

  function resolveAudioContextCtor(): typeof AudioContext {
    if (!import.meta.client || typeof window === 'undefined') {
      throw new AudioPlaybackError('AudioContext is unavailable outside the browser');
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      throw new AudioPlaybackError('Web Audio API is not supported in this browser');
    }
    return Ctor;
  }

  /** Build the persistent gain → destination graph once. Idempotent. */
  function ensureGraph(): void {
    if (audioContext && audioContext.state !== 'closed' && gainNode && destinationNode) {
      return;
    }
    const Ctor = resolveAudioContextCtor();
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = lastVolume;
    const destination = ctx.createMediaStreamDestination();
    gain.connect(destination);
    // Local monitor: also route to speakers so the DJ hears their own music.
    // Permanently connected (ADR 0018) — the DJ always hears their own music.
    gain.connect(ctx.destination);

    audioContext = ctx;
    gainNode = gain;
    destinationNode = destination;
  }

  // ========================================
  // Decode (lazy) + memory bound
  // ========================================

  async function decode(id: string, file: File): Promise<AudioBuffer> {
    const cached = decoded.get(id);
    if (cached) return cached;

    ensureGraph();
    const ctx = audioContext!;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      decoded.set(id, buffer);
      return buffer;
    } catch (err) {
      throw new AudioPlaybackError(
        `Could not decode "${file.name}" — it may be corrupt, an unsupported format, or too large.`,
        err,
      );
    }
  }

  /** Drop every decoded buffer whose id is not in `keep` so resident PCM stays ~1–2 songs. */
  function releaseExcept(keep: Array<string | null>): void {
    for (const id of decoded.keys()) {
      if (!keep.includes(id)) {
        decoded.delete(id);
      }
    }
  }

  // ========================================
  // Source swap
  // ========================================

  /** Tear down the active source without firing its natural-end callback. */
  function teardownSource(): void {
    if (!sourceNode) return;
    sourceNode.onended = null;
    if (sourceStarted) {
      try {
        sourceNode.stop();
      } catch {
        /* already stopped */
      }
    }
    sourceNode.disconnect();
    sourceNode = null;
    sourceStarted = false;
  }

  /** Create a fresh source for `buffer` connected to the persistent gain node. */
  function createSource(buffer: AudioBuffer): AudioBufferSourceNode {
    const ctx = audioContext!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode!);
    // Natural end only: programmatic stops null this handler first (teardownSource).
    source.onended = () => {
      if (sourceNode === source && status === 'playing') {
        status = 'idle';
        onEnded?.();
      }
    };
    return source;
  }

  // ========================================
  // Public API
  // ========================================

  function getOutputTrack(): MediaStreamTrack {
    ensureGraph();
    const track = destinationNode!.stream.getAudioTracks()[0];
    if (!track) {
      throw new AudioPlaybackError('MediaStreamDestination produced no audio track');
    }
    return track;
  }

  async function play(id: string, file: File): Promise<{ duration: number }> {
    ensureGraph();
    const ctx = audioContext!;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const buffer = await decode(id, file);

    forceReleaseDuck(); // track change never carries a duck across the boundary

    teardownSource();
    sourceNode = createSource(buffer);
    sourceNode.start(0, 0);
    sourceStarted = true;

    currentId = id;
    currentDuration = buffer.duration;
    startOffset = 0;
    startTime = ctx.currentTime;
    status = 'playing';

    // Keep only the now-current track and any prefetched next resident.
    releaseExcept([currentId, prefetchedId]);

    return { duration: buffer.duration };
  }

  function prefetch(id: string, file: File): void {
    if (decoded.has(id)) {
      prefetchedId = id;
      return;
    }
    prefetchedId = id;
    decode(id, file)
      .then(() => releaseExcept([currentId, prefetchedId]))
      .catch((err) => log.warn('Prefetch decode failed', err));
  }

  async function pause(): Promise<void> {
    if (!audioContext || status !== 'playing') return;
    startOffset = getPosition();
    await audioContext.suspend();
    status = 'paused';
  }

  async function resume(): Promise<void> {
    if (!audioContext || status !== 'paused') return;
    await audioContext.resume();
    // A seek while paused leaves an unstarted source — start it now.
    if (sourceNode && !sourceStarted) {
      sourceNode.start(0, startOffset);
      sourceStarted = true;
    }
    startTime = audioContext.currentTime;
    status = 'playing';
  }

  function seek(position: number): void {
    if (!audioContext || !gainNode || currentId === null) return;
    const buffer = decoded.get(currentId);
    if (!buffer) return;

    const clamped = Math.max(0, Math.min(position, buffer.duration));

    teardownSource();
    sourceNode = createSource(buffer);
    startOffset = clamped;

    if (status === 'playing') {
      sourceNode.start(0, clamped);
      sourceStarted = true;
      startTime = audioContext.currentTime;
    }
    // While paused, leave the source unstarted; resume() starts it at the offset.
  }

  function setVolume(volume: number): void {
    lastVolume = Math.max(0, Math.min(1, volume));
    if (!gainNode) return;
    if (isDucked) {
      // Mid-duck slider move: re-anchor the live (ducked) value to the new
      // slider × fraction so the eventual release lands on the new slider
      // value (story 13) without an audible jump right now.
      const now = audioContext?.currentTime ?? 0;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(lastVolume * duckFraction, now);
    } else {
      gainNode.gain.value = lastVolume;
    }
  }

  /** Ramp the master gain from its current live value to `target` over `rampMs`, on the audio thread. */
  function rampGainTo(target: number, rampMs: number): void {
    if (!audioContext || !gainNode) return;
    const now = audioContext.currentTime;
    const current = gainNode.gain.value;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(current, now);
    gainNode.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, target)), now + rampMs / 1000);
  }

  function duck(fraction: number, rampMs: number): void {
    if (!gainNode) return;
    duckFraction = Math.max(0, Math.min(1, fraction));
    isDucked = true;
    rampGainTo(lastVolume * duckFraction, rampMs);
  }

  function releaseDuck(rampMs: number): void {
    if (!gainNode) return;
    isDucked = false;
    rampGainTo(lastVolume, rampMs);
  }

  /**
   * Instant, unconditional restore — used on track change / stop / dispose so
   * the music is never left stuck quiet regardless of duck state.
   */
  function forceReleaseDuck(): void {
    isDucked = false;
    if (!audioContext || !gainNode) return;
    const now = audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(lastVolume, now);
  }

  function getPosition(): number {
    if (!audioContext || status !== 'playing') {
      return startOffset;
    }
    return startOffset + (audioContext.currentTime - startTime);
  }

  function getDuration(): number {
    return currentDuration;
  }

  function getStatus(): EnginePlaybackStatus {
    return status;
  }

  function setOnEnded(cb: (() => void) | null): void {
    onEnded = cb;
  }

  function stop(): void {
    forceReleaseDuck();
    teardownSource();
    currentId = null;
    currentDuration = 0;
    startOffset = 0;
    startTime = 0;
    status = 'idle';
    releaseExcept([prefetchedId]);
  }

  function dispose(): void {
    forceReleaseDuck();
    teardownSource();
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
    destinationNode = null;
    decoded.clear();
    currentId = null;
    prefetchedId = null;
    currentDuration = 0;
    startOffset = 0;
    startTime = 0;
    status = 'idle';
    onEnded = null;

    const ctx = audioContext;
    audioContext = null;
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch((err) => log.warn('Failed to close AudioContext', err));
    }
  }

  return {
    getOutputTrack,
    play,
    prefetch,
    pause,
    resume,
    seek,
    setVolume,
    duck,
    releaseDuck,
    getPosition,
    getDuration,
    getStatus,
    setOnEnded,
    stop,
    dispose,
  };
}
