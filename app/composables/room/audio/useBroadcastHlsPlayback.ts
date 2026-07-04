/**
 * useBroadcastHlsPlayback — passive-Listener HLS playback for broadcast mode
 * (realtime-09 infrastructure).
 *
 * Owns a single hidden `<audio>` element + an hls.js instance. `start(url)`
 * attaches the CDN HLS stream and plays; `stop()` tears it down. The orchestrator
 * (`useRoomAudio`) drives start/stop from `selectMediaTransport(mode, isSpeaker,
 * hlsPlaybackUrl)` and mutes the WebRTC consumers while HLS is active so the
 * Listener never hears both tiers at once.
 *
 * The player is a **module-level singleton** (realtime-21): `useRoomAudio()` is
 * called at many mounted sites, so the HLS tier — like `useAudioSocket`'s socket —
 * must be shared, or a broadcast flip would start one `<audio>` element per caller
 * on the same stream and echo. The accessor returns references to the one player.
 *
 * Robust to the cold-start race: when a Room has just flipped to broadcast the
 * manifest doesn't exist on R2 until FFmpeg writes the first segment (~2–4s after
 * promote, longer if a speaker hasn't taken a seat yet) — so `master.m3u8` 404s.
 * We make hls.js ride that window NATIVELY via a generous manifest/playlist
 * `errorRetry` policy (capped exponential backoff) instead of going fatal after
 * one try and hammering `startLoad()` in a tight loop (the prod symptom: dozens
 * of "networkError" + `AbortError: play() interrupted by a new load request`).
 * We also defer `play()` until `MANIFEST_PARSED` — calling it before media is
 * attached is what the reload kept interrupting. The fatal handler is a
 * last-resort with backoff + a cap. hls.js is dynamically imported so it never
 * enters the SSR bundle; on Safari we fall back to native HLS (`canPlayType`).
 */
// `ref`/`readonly`/`Ref` are Nuxt auto-imports, but this module now uses them at
// MODULE scope (the realtime-21 singleton state) — evaluated at import time — and
// the file is imported directly by unit tests outside the Nuxt runtime, where the
// auto-import isn't wired. Import them explicitly so module evaluation never hits
// a `ref is not defined` ReferenceError.
import { ref, readonly, type Ref } from 'vue';
import { createLogger } from '~/utils/logger';

const log = createLogger('[BroadcastHls]');

/**
 * Cold-start tolerance: how many times hls.js retries a 404'd manifest/playlist
 * before declaring a fatal error. With 1s→8s capped backoff this rides ~2–3 min
 * — long enough for a speaker to take a seat and FFmpeg to publish the manifest.
 */
export const COLD_START_MAX_RETRY = 30;
/** Backoff before the last-resort fatal-error reload, so it can't tight-loop. */
const FATAL_RELOAD_BACKOFF_MS = 3000;

/**
 * Override a hls.js load policy's `errorRetry` so a cold-start 404 is retried
 * (capped 1s→8s backoff) instead of going fatal after one try — while preserving
 * the policy's `timeoutRetry` and timeout fields. Pure; exported for unit tests.
 */
export function withColdStartRetry<P extends { default: Record<string, unknown> }>(
  policy: P,
): P {
  return {
    ...policy,
    default: {
      ...policy.default,
      errorRetry: {
        maxNumRetry: COLD_START_MAX_RETRY,
        retryDelayMs: 1000,
        maxRetryDelayMs: 8000,
      },
    },
  };
}

export interface UseBroadcastHlsPlaybackReturn {
  /** Attach + play the given HLS playback URL (idempotent for the same URL). */
  start: (playbackUrl: string) => Promise<void>;
  /** Detach hls.js and stop the audio element. */
  stop: () => void;
  /** Set playback volume (0–1). */
  setVolume: (volume: number) => void;
  /** True while an HLS stream is attached. */
  isActive: Readonly<Ref<boolean>>;
  /** Re-issue play() after a mobile/PWA resume (autoplay may have been blocked). */
  resume: () => Promise<void>;
}

// ============================================
// Module-level singleton state (realtime-21)
// ============================================
// CRITICAL — like `useAudioSocket`'s socket, the broadcast-HLS tier MUST be a
// single shared player. `useRoomAudio()` is instantiated at ~8 mounted sites and
// each call used to mint its OWN player, so a broadcast flip started N `<audio>`
// elements on the same CDN stream → echo/phasing for passive Listeners
// (realtime-21). Hoisting the state to module scope makes every caller drive the
// same element: concurrent `start(sameUrl)` calls collapse to the idempotent
// no-op below, and there is exactly one decoder regardless of caller count.
const isActive = ref(false);
let audio: HTMLAudioElement | null = null;
// hls.js instance — typed loosely to keep the dynamic import out of SSR types.
let hls: {
  destroy: () => void;
  loadSource: (u: string) => void;
  attachMedia: (e: HTMLMediaElement) => void;
  startLoad: () => void;
  recoverMediaError: () => void;
  on: (ev: string, cb: (e: unknown, d: unknown) => void) => void;
} | null = null;
let currentUrl: string | null = null;
let volume = 1;
// Backoff timer for the last-resort fatal reload (cleared on stop/teardown).
let fatalReloadTimer: ReturnType<typeof setTimeout> | null = null;

async function start(playbackUrl: string): Promise<void> {
  if (!import.meta.client) return;
  if (isActive.value && currentUrl === playbackUrl) return; // idempotent
  stop();

  currentUrl = playbackUrl;
  audio = new Audio();
  audio.autoplay = true;
  audio.preload = 'auto';
  audio.volume = volume;

  const { default: Hls } = await import('hls.js');

  // realtime-10: a stop() (transport handoff back to WebRTC) may have run while
  // the dynamic import was in flight — it nulls `currentUrl` + `audio`. Bail on
  // the now-stale start so we don't attachMedia to a null element or set
  // isActive true for a stream nobody wants. The next transition re-issues start.
  if (currentUrl !== playbackUrl || !audio) return;

  if (Hls.isSupported()) {
    // Cold-start retry policy (withColdStartRetry): ride a 404'd
    // manifest/playlist via hls.js's own capped-backoff retry instead of going
    // fatal after one try. This is what makes the broadcast tier survive the
    // inherent promote→first-segment window without the networkError storm.
    hls = new Hls({
      // Short-segment live tuning: stay near the live edge, recover fast.
      // We serve full fMP4 segments (no #EXT-X-PART partials — R2 isn't an
      // LL-HLS origin), so lowLatencyMode is inert and left off; latency is
      // driven by hold-back × segment duration instead.
      lowLatencyMode: false,
      // Sit ~2 segments back from live edge (was 3) — ~1s closer to live.
      liveSyncDurationCount: 2,
      // Cap drift; if the player falls further behind, snap forward.
      liveMaxLatencyDurationCount: 6,
      // Nudge playback up to 1.5× to catch the live edge after a stall/buffer,
      // instead of permanently drifting back.
      maxLiveSyncPlaybackRate: 1.5,
      enableWorker: true,
      manifestLoadPolicy: withColdStartRetry(Hls.DefaultConfig.manifestLoadPolicy),
      playlistLoadPolicy: withColdStartRetry(Hls.DefaultConfig.playlistLoadPolicy),
    }) as unknown as typeof hls;
    // Defer play() until media actually exists. Calling it right after
    // attachMedia (before the manifest parses) is what each reload kept
    // interrupting → AbortError("play() interrupted by a new load request").
    hls!.on(Hls.Events.MANIFEST_PARSED, () => {
      void tryPlay();
    });
    hls!.on(Hls.Events.ERROR, (_event: unknown, data: unknown) => {
      const d = data as { fatal?: boolean; type?: string };
      // Non-fatal errors (incl. the cold-start 404 retries above) are handled
      // by hls.js itself — don't intervene, that's what caused the tight loop.
      if (!d?.fatal) return;
      if (d.type === 'mediaError') {
        log.warn('Fatal media error — recovering');
        hls?.recoverMediaError();
        return;
      }
      if (d.type === 'networkError') {
        // Exhausted the retry policy (manifest still missing after minutes).
        // Reload ONCE after a backoff — never tight-loop.
        if (fatalReloadTimer) return;
        log.warn('Fatal network error — reloading after backoff');
        fatalReloadTimer = setTimeout(() => {
          fatalReloadTimer = null;
          hls?.startLoad();
        }, FATAL_RELOAD_BACKOFF_MS);
        return;
      }
      log.error('Fatal HLS error', { type: d.type });
    });
    hls!.loadSource(playbackUrl);
    hls!.attachMedia(audio);
  } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari / iOS: native HLS (the element retries the manifest itself).
    audio.src = playbackUrl;
    void tryPlay();
  } else {
    log.error('HLS is not supported in this browser');
    return;
  }

  isActive.value = true;
  log.info('HLS playback starting', { playbackUrl });
}

/**
 * Attempt playback; autoplay may be blocked until a user gesture, in which case
 * `resume()` retries on the next interaction/app-resume. Never throws.
 */
async function tryPlay(): Promise<void> {
  if (!audio) return;
  await audio.play().catch((err) => {
    log.warn('HLS autoplay blocked or failed', { err });
  });
}

function stop(): void {
  if (fatalReloadTimer) {
    clearTimeout(fatalReloadTimer);
    fatalReloadTimer = null;
  }
  if (hls) {
    hls.destroy();
    hls = null;
  }
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio = null;
  }
  currentUrl = null;
  isActive.value = false;
}

function setVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
  if (audio) audio.volume = volume;
}

async function resume(): Promise<void> {
  if (audio && isActive.value) await tryPlay();
}

const readonlyIsActive = readonly(isActive);

/**
 * Accessor for the singleton broadcast-HLS player (realtime-21). Returns shared
 * references — calling this from multiple components/composables does NOT create
 * additional players; they all drive the one module-level `<audio>` element.
 */
export function useBroadcastHlsPlayback(): UseBroadcastHlsPlaybackReturn {
  return { start, stop, setVolume, isActive: readonlyIsActive, resume };
}
