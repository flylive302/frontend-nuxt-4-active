/**
 * Room Video HTML playback adapter (room-video-player 06)
 *
 * One `<video>` element that plays a direct MP4 or an HLS stream. Implements
 * `VideoPlayerAdapter` so the sync composable drives it from the Snapshot and
 * never touches the element itself.
 *
 * HLS rules (proven on device):
 * - hls.js (MSE) whenever `Hls.isSupported()`. This is the only path on Chrome /
 *   Android: the built-in Chrome player plays MPEG-TS HLS but rejects fMP4, so an
 *   HLS URL is NEVER handed to the element directly there.
 * - Native HLS only on Apple WebKit (`isAppleWebKit`), and only when hls.js is
 *   unsupported (iPhone has no MSE on old iOS).
 * - Exactly one `Hls` instance is alive per adapter: a new `load()` destroys the
 *   old one first. This is NOT the broadcast tier's singleton
 *   (`useBroadcastHlsPlayback`); the two never share an instance.
 *
 * INFRA only: no store, socket, toast or Vue imports. Every browser dependency
 * (element, hls.js loader, user agent) is read at call time and can be injected,
 * so nothing here touches `window` / `document` at import time and the unit
 * tests run without a DOM.
 */
import { createLogger } from '~/utils/logger';
import type {
  RoomVideoSource,
  VideoAdapterError,
  VideoAdapterEvent,
  VideoPlayerAdapter,
  VideoPlayerAdapterFactory,
} from '~/types/room/video';

const log = createLogger('[RoomVideoHtmlAdapter]');

// ============================================
// CONSTANTS
// ============================================

/** Mirrors `HTMLMediaElement.HAVE_METADATA` (not available outside a browser). */
const HAVE_METADATA = 1;

/** `canPlayType` argument that detects native HLS (Apple WebKit only). */
const NATIVE_HLS_MIME_TYPE = 'application/vnd.apple.mpegurl';

/** `DOMException.name` of an autoplay refusal. */
const NOT_ALLOWED_ERROR_NAME = 'NotAllowedError';

/** `DOMException.name` of a `play()` interrupted by our own `pause()` / `load()` / `destroy()`. */
const ABORT_ERROR_NAME = 'AbortError';

const FULL_SIZE = '100%';

/** Adapter `error` codes minted here (prefixed codes are built where they occur). */
const ERROR_CODE = {
  UNSUPPORTED_SOURCE: 'unsupported_source',
  HLS_UNSUPPORTED: 'hls_unsupported',
  HLS_LOAD_FAILED: 'hls_load_failed',
  PLAY_FAILED: 'play_failed',
  UNKNOWN: 'unknown',
} as const;

/** iPhone / iPad / iPod: every browser there is WebKit, incl. the Capacitor WKWebView. */
const IOS_DEVICE_PATTERN = /iPhone|iPad|iPod/;

const SAFARI_PATTERN = /Safari/;

/** Browsers whose UA contains "Safari" but run a different engine. */
const NOT_SAFARI_PATTERN = /Chrome|CriOS|Chromium|Android|Edg|FxiOS/;

// ============================================
// TYPES
// ============================================

/** The slice of an hls.js error event this adapter reads. */
interface HlsErrorData {
  fatal?: boolean;
  type?: string;
  details?: string;
}

/** The slice of an hls.js instance this adapter uses. */
interface HlsInstanceLike {
  loadSource(url: string): void;
  attachMedia(media: HTMLVideoElement): void;
  destroy(): void;
  recoverMediaError(): void;
  on(event: string, listener: (event: string, data: HlsErrorData) => void): void;
}

/** The slice of the hls.js class this adapter uses. */
export interface HlsConstructorLike {
  new (): HlsInstanceLike;
  isSupported(): boolean;
  readonly Events: { readonly ERROR: string };
  readonly ErrorTypes: { readonly MEDIA_ERROR: string };
}

/** Browser dependencies, injectable so the adapter is testable without a DOM. */
export interface HtmlVideoAdapterDeps {
  /** Builds the `<video>` element. Default: `document.createElement('video')`. */
  createVideo?: () => HTMLVideoElement;
  /** Loads hls.js (dynamic import). Default: `import('hls.js')`. */
  loadHls?: () => Promise<HlsConstructorLike>;
  /** The user agent string, read when an HLS source loads. Default: `navigator.userAgent`. */
  userAgent?: () => string;
}

type Subscriber = (error?: VideoAdapterError) => void;

// ============================================
// DEFAULT DEPENDENCIES (browser-only, evaluated at call time)
// ============================================

function defaultCreateVideo(): HTMLVideoElement {
  return document.createElement('video');
}

async function defaultLoadHls(): Promise<HlsConstructorLike> {
  const { default: Hls } = await import('hls.js');
  // hls.js types its `on` overloads per event; the adapter only needs the structural slice above.
  return Hls as unknown as HlsConstructorLike;
}

function defaultUserAgent(): string {
  return navigator.userAgent;
}

// ============================================
// PURE HELPERS
// ============================================

/**
 * True when the engine is Apple WebKit, the only place native HLS in a `<video>`
 * is trusted: any browser on iPhone / iPad / iPod (incl. the Capacitor iOS
 * WKWebView, whose UA has no "Safari") and desktop Safari. Chrome, Edge, Firefox
 * and every Android WebView are false even though several carry "Safari" in the UA.
 */
export function isAppleWebKit(ua: string): boolean {
  if (IOS_DEVICE_PATTERN.test(ua)) return true;
  return SAFARI_PATTERN.test(ua) && !NOT_SAFARI_PATTERN.test(ua);
}

function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const { name } = error as { name: unknown };
    if (typeof name === 'string') return name;
  }
  return ERROR_CODE.UNKNOWN;
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string' && message !== '') return message;
  }
  return fallback;
}

// ============================================
// ADAPTER
// ============================================

export const createHtmlVideoAdapter = ((
  container: HTMLElement,
  deps: HtmlVideoAdapterDeps = {},
): VideoPlayerAdapter => {
  const createVideo = deps.createVideo ?? defaultCreateVideo;
  const loadHls = deps.loadHls ?? defaultLoadHls;
  const userAgent = deps.userAgent ?? defaultUserAgent;

  const video = createVideo();
  const subscribers = new Map<VideoAdapterEvent, Set<Subscriber>>();

  /** The one live hls.js instance, or null (mp4, native HLS, nothing loaded). */
  let hls: HlsInstanceLike | null = null;
  /** Bumped by every `load()` and by `destroy()`; a stale async load compares and bails. */
  let loadToken = 0;
  /** The in-flight HLS attach (never rejects); `play()` waits on it. */
  let pendingLoad: Promise<void> | null = null;
  /** A `seek()` that arrived before metadata; last one wins. */
  let pendingSeekSec: number | null = null;
  let hasEmittedReady = false;
  let hasRecoveredMedia = false;
  /** The current load ended with no source on the element (unsupported / failed). */
  let hasNoSource = false;
  let isDestroyed = false;

  // ------------------------------------------
  // Events
  // ------------------------------------------

  function emit(event: VideoAdapterEvent, error?: VideoAdapterError): void {
    if (isDestroyed) return;
    const group = subscribers.get(event);
    if (!group) return;
    for (const subscriber of [...group]) {
      try {
        subscriber(error);
      } catch (thrown) {
        log.error('Subscriber threw', event, thrown);
      }
    }
  }

  /** The load produced nothing playable; `play()` must not try the empty element. */
  function failWithoutSource(code: string, message: string): void {
    hasNoSource = true;
    emit('error', { code, message });
  }

  function handleLoadedMetadata(): void {
    if (pendingSeekSec !== null) {
      video.currentTime = pendingSeekSec;
      pendingSeekSec = null;
    }
    if (hasEmittedReady) return;
    hasEmittedReady = true;
    emit('ready');
  }

  function handleMediaError(): void {
    const mediaError = video.error;
    emit('error', {
      code: `media_${mediaError?.code ?? ERROR_CODE.UNKNOWN}`,
      message: mediaError?.message ? mediaError.message : 'Media element error',
    });
  }

  function handleHlsError(
    instance: HlsInstanceLike,
    mediaErrorType: string,
    data: HlsErrorData,
  ): void {
    // Non-fatal errors (incl. segment retries) are hls.js's own business.
    if (instance !== hls || !data.fatal) return;
    if (data.type === mediaErrorType && !hasRecoveredMedia) {
      hasRecoveredMedia = true;
      log.warn('Fatal media error, recovering once', data.details);
      instance.recoverMediaError();
      return;
    }
    emit('error', {
      code: `hls_${data.type ?? ERROR_CODE.UNKNOWN}`,
      message: data.details ?? 'Fatal HLS error',
    });
  }

  const elementListeners: ReadonlyArray<readonly [string, () => void]> = [
    ['loadedmetadata', handleLoadedMetadata],
    ['playing', () => emit('playing')],
    ['pause', () => emit('paused')],
    ['ended', () => emit('ended')],
    ['error', handleMediaError],
  ];

  // ------------------------------------------
  // Source loading
  // ------------------------------------------

  /** Destroy the Hls instance and empty the element (no `src=''`: that raises a media error). */
  function releaseSource(): void {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    video.removeAttribute('src');
    video.load();
  }

  async function attachHls(url: string, token: number): Promise<void> {
    try {
      const Hls = await loadHls();
      // A destroy() or a newer load() ran while hls.js was loading: attach nothing.
      if (token !== loadToken) return;

      if (Hls.isSupported()) {
        const instance = new Hls();
        hls = instance;
        instance.on(Hls.Events.ERROR, (_event, data) =>
          handleHlsError(instance, Hls.ErrorTypes.MEDIA_ERROR, data),
        );
        instance.loadSource(url);
        instance.attachMedia(video);
        return;
      }

      if (isAppleWebKit(userAgent()) && video.canPlayType(NATIVE_HLS_MIME_TYPE) !== '') {
        video.src = url;
        return;
      }

      failWithoutSource(ERROR_CODE.HLS_UNSUPPORTED, 'HLS is not supported in this browser');
    } catch (thrown) {
      if (token !== loadToken) return;
      log.error('HLS attach failed', thrown);
      releaseSource();
      failWithoutSource(ERROR_CODE.HLS_LOAD_FAILED, errorMessage(thrown, 'Could not load the HLS player'));
    }
  }

  function load(source: RoomVideoSource): void {
    if (isDestroyed) return;
    loadToken += 1;
    const token = loadToken;

    releaseSource();
    pendingLoad = null;
    pendingSeekSec = null;
    hasEmittedReady = false;
    hasRecoveredMedia = false;
    hasNoSource = false;

    if (source.kind === 'youtube') {
      failWithoutSource(ERROR_CODE.UNSUPPORTED_SOURCE, 'YouTube is not supported by this player');
      return;
    }
    if (source.container === 'mp4') {
      video.src = source.url;
      return;
    }
    pendingLoad = attachHls(source.url, token);
  }

  // ------------------------------------------
  // Transport
  // ------------------------------------------

  /** Wait for the in-flight HLS attach, including one started while waiting. */
  async function settleLoad(): Promise<void> {
    let waited = pendingLoad;
    while (waited) {
      await waited;
      if (pendingLoad === waited) return;
      waited = pendingLoad;
    }
  }

  async function play(): Promise<void> {
    try {
      await settleLoad();
      if (isDestroyed || hasNoSource) return;
      await video.play();
    } catch (thrown) {
      if (isDestroyed) return;
      const name = errorName(thrown);
      if (name === NOT_ALLOWED_ERROR_NAME) {
        emit('blocked');
      } else if (name === ABORT_ERROR_NAME) {
        // Our own pause() / load() interrupted it; not a playback failure.
        log.debug('play() interrupted');
      } else {
        emit('error', { code: ERROR_CODE.PLAY_FAILED, message: errorMessage(thrown, 'play() failed') });
      }
    }
  }

  function pause(): void {
    if (isDestroyed) return;
    video.pause();
  }

  function seek(sec: number): void {
    if (isDestroyed || !Number.isFinite(sec)) return;
    if (video.readyState < HAVE_METADATA) {
      pendingSeekSec = sec;
      return;
    }
    video.currentTime = sec;
  }

  function currentTime(): number {
    return video.currentTime || 0;
  }

  function setMuted(muted: boolean): void {
    video.muted = muted;
  }

  function on(event: VideoAdapterEvent, cb: Subscriber): () => void {
    if (isDestroyed) return () => undefined;
    let group = subscribers.get(event);
    if (!group) {
      group = new Set();
      subscribers.set(event, group);
    }
    group.add(cb);
    return () => {
      subscribers.get(event)?.delete(cb);
    };
  }

  function destroy(): void {
    if (isDestroyed) return;
    isDestroyed = true;
    loadToken += 1;
    pendingLoad = null;
    pendingSeekSec = null;

    video.pause();
    releaseSource();
    for (const [type, listener] of elementListeners) video.removeEventListener(type, listener);
    video.remove();
    subscribers.clear();
  }

  // ------------------------------------------
  // Setup
  // ------------------------------------------

  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto';
  video.style.width = FULL_SIZE;
  video.style.height = FULL_SIZE;
  video.style.objectFit = 'contain';
  for (const [type, listener] of elementListeners) video.addEventListener(type, listener);
  container.appendChild(video);

  return { load, play, pause, seek, currentTime, setMuted, destroy, on };
}) satisfies VideoPlayerAdapterFactory;
