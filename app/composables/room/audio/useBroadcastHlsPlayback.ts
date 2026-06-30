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
 * Robust to the cold-start race: when a Room has just flipped to broadcast the
 * first segments may not be on R2 yet (manifest 404s); hls.js retries, and the
 * ERROR handler restarts loading on a recoverable network/media error rather
 * than giving up. hls.js is dynamically imported so it never enters the SSR
 * bundle; on Safari we fall back to native HLS (`canPlayType`).
 */
import { createLogger } from '~/utils/logger';

const log = createLogger('[BroadcastHls]');

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

export function useBroadcastHlsPlayback(): UseBroadcastHlsPlaybackReturn {
  const isActive = ref(false);
  let audio: HTMLAudioElement | null = null;
  // hls.js instance — typed loosely to keep the dynamic import out of SSR types.
  let hls: { destroy: () => void; loadSource: (u: string) => void; attachMedia: (e: HTMLMediaElement) => void; startLoad: () => void; on: (ev: string, cb: (e: unknown, d: unknown) => void) => void } | null = null;
  let currentUrl: string | null = null;
  let volume = 1;

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

    if (Hls.isSupported()) {
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
      }) as unknown as typeof hls;
      hls!.on(Hls.Events.ERROR, (_event: unknown, data: unknown) => {
        const d = data as { fatal?: boolean; type?: string };
        if (!d?.fatal) return;
        // Cold-start manifest 404s / transient network blips: keep trying rather
        // than tearing down — segments appear within a few seconds of promote.
        if (d.type === 'networkError' || d.type === 'mediaError') {
          log.warn('Recoverable HLS error — restarting load', { type: d.type });
          hls?.startLoad();
        } else {
          log.error('Fatal HLS error', { type: d.type });
        }
      });
      hls!.loadSource(playbackUrl);
      hls!.attachMedia(audio);
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS: native HLS.
      audio.src = playbackUrl;
    } else {
      log.error('HLS is not supported in this browser');
      return;
    }

    isActive.value = true;
    await audio.play().catch((err) => {
      // Autoplay may be blocked until a user gesture; resume() retries later.
      log.warn('HLS autoplay blocked or failed', { err });
    });
    log.info('HLS playback started', { playbackUrl });
  }

  function stop(): void {
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
    if (audio && isActive.value) {
      await audio.play().catch((err) => log.warn('HLS resume play failed', { err }));
    }
  }

  return { start, stop, setVolume, isActive: readonly(isActive), resume };
}
