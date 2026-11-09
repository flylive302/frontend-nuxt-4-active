/**
 * Room Video YouTube playback adapter (room-video-player 08)
 *
 * One YouTube IFrame Player API player bound to a container element. Implements
 * `VideoPlayerAdapter` so the sync composable drives it from the Snapshot and
 * never touches the player itself.
 *
 * Rules (proven on device):
 * - The sync calls `load()` -> `seek()` -> `play()` / `pause()` synchronously, long
 *   before the API script or the player is ready. Everything is queued (video id,
 *   start position, intent, mute) and applied once, from `onReady`.
 * - A fresh `load()` destroys the old player and builds a new one: one code path,
 *   no state left over from the previous video, and stale callbacks of the old
 *   player are dropped by a load token.
 * - The adapter owns an `intent` (`play` / `pause`; a fresh load resets to
 *   `pause`). `seekTo()` on a paused or unstarted YouTube player STARTS playback,
 *   so while the intent is `pause`: every seek is followed by `pauseVideo()`, a
 *   PLAYING / BUFFERING state is answered with `pauseVideo()`, and that PLAYING is
 *   NOT forwarded as `playing` (the sync clears its "hold" flag on `playing`).
 * - A paused fresh load uses `cueVideoById` (never plays); a playing one uses
 *   `loadVideoById`. Both take `startSeconds`, so `ready` is emitted only after the
 *   start position has been applied.
 * - The IFrame API has no `NotAllowedError`: a play attempt that is neither PLAYING
 *   nor still BUFFERING when `ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS` runs out was
 *   refused, and `blocked` is emitted once (a refusal can pass through BUFFERING
 *   and fall back to UNSTARTED, so BUFFERING does not cancel the probe; PLAYING
 *   does). `play()` on a player that is already PLAYING / BUFFERING never arms it.
 * - `currentTime()` reports the pending position (start / last seek) until the
 *   player reports a real state — a cued or paused player may never report one.
 *   After a seek on a PLAYING player that reports nothing new, the hint expires
 *   after `ROOM_VIDEO_YOUTUBE_SEEK_HINT_MS` so the position can never freeze.
 *
 * INFRA only: no store, socket, toast or Vue imports. Every browser dependency
 * (API loader, host element, timers, `window`, `document`) is read at call time
 * and can be injected, so nothing here touches the DOM at import time and the
 * unit tests run without one.
 */
import { createLogger } from '~/utils/logger';
import {
  ROOM_VIDEO_YOUTUBE_API_SRC,
  ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS,
  ROOM_VIDEO_YOUTUBE_SEEK_HINT_MS,
} from '~/constants/room';
import type {
  RoomVideoSource,
  VideoAdapterError,
  VideoAdapterEvent,
  VideoPlayerAdapter,
  VideoPlayerAdapterFactory,
} from '~/types/room/video';

const log = createLogger('[RoomVideoYouTube]');

// ============================================
// CONSTANTS
// ============================================

const FULL_SIZE = '100%';

/** `YT.PlayerState` values. A plain object (not `const enum`): isolatedModules. */
export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/** The `onError` codes of the IFrame Player API that get their own message. */
export const YT_ERROR_CODE = {
  INVALID_PARAM: 2,
  HTML5_ERROR: 5,
  NOT_FOUND: 100,
  EMBED_DISABLED: 101,
  EMBED_DISABLED_DISGUISED: 150,
  PLATFORM_BLOCKED: 153,
} as const;

/** Adapter `error` codes minted here. */
const ERROR_CODE = {
  UNSUPPORTED_SOURCE: 'unsupported_source',
  NOT_FOUND: 'youtube_not_found',
  EMBED_DISABLED: 'youtube_embed_disabled',
  PLATFORM_BLOCKED: 'youtube_platform_blocked',
  BAD_REQUEST: 'youtube_bad_request',
  PLAYER_ERROR: 'youtube_player_error',
  API_UNAVAILABLE: 'youtube_api_unavailable',
} as const;

/** Plain-English toast lines (`VideoAdapterError.userMessage`). */
const USER_MESSAGE = {
  NOT_FOUND: 'This YouTube video was removed or is private.',
  EMBED_DISABLED: "This video's owner doesn't allow it to play outside YouTube.",
  PLATFORM_BLOCKED: "YouTube won't play inside this app. Open it on YouTube instead.",
  BAD_REQUEST: "That YouTube link doesn't look right. Paste it again.",
  PLAYER_ERROR: "This YouTube video can't play here. Try another one.",
  API_UNAVAILABLE: "YouTube couldn't load. Check your connection and try again.",
} as const;

/**
 * `YT.Player` options. `origin` is deliberately absent. `controls: 0` +
 * `disablekb: 1` + `fs: 0`: the room's own seek bar is the only control.
 */
const PLAYER_VARS = {
  playsinline: 1,
  enablejsapi: 1,
  rel: 0,
  controls: 0,
  disablekb: 1,
  fs: 0,
  iv_load_policy: 3,
  autoplay: 0,
} as const;

// ============================================
// TYPES
// ============================================

/** The slice of `YT.PlayerVars` this adapter sets. */
export interface YTPlayerVarsLike {
  readonly playsinline: number;
  readonly enablejsapi: number;
  readonly rel: number;
  readonly controls: number;
  readonly disablekb: number;
  readonly fs: number;
  readonly iv_load_policy: number;
  readonly autoplay: number;
}

/** `onStateChange` / `onError` payload: `data` is the state or the error code. */
export interface YTPlayerEventLike {
  data: number;
}

export interface YTPlayerEventsLike {
  onReady: () => void;
  onStateChange: (event: YTPlayerEventLike) => void;
  onError: (event: YTPlayerEventLike) => void;
}

export interface YTPlayerOptionsLike {
  width: string;
  height: string;
  playerVars: YTPlayerVarsLike;
  events: YTPlayerEventsLike;
}

export interface YTVideoByIdArgsLike {
  videoId: string;
  startSeconds: number;
}

/** The slice of a `YT.Player` instance this adapter uses. Only `destroy` is safe before `onReady`. */
export interface YTPlayerLike {
  cueVideoById(args: YTVideoByIdArgsLike): void;
  loadVideoById(args: YTVideoByIdArgsLike): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  destroy(): void;
}

/** The slice of the global `YT` namespace this adapter uses. */
export interface YTNamespaceLike {
  Player: new (host: HTMLElement, options: YTPlayerOptionsLike) => YTPlayerLike;
}

/**
 * The page globals the IFrame API touches. `YT` exists as a half-built object
 * (`{ loading: 1 }`) while the script runs, so only `YT.Player` proves it is ready.
 */
export interface YouTubeApiGlobal {
  YT?: { Player?: YTNamespaceLike['Player'] } | undefined;
  onYouTubeIframeAPIReady?: (() => void) | undefined;
}

/** `window` / `document` access of the script loader, injectable for DOM-free tests. */
export interface YouTubeApiLoaderDeps {
  /** The page's global scope. Default: `window`. */
  getGlobal?: () => YouTubeApiGlobal;
  /** Adds the `<script>`; calls `onError` if it fails to load. Default: `document.head.appendChild`. */
  injectScript?: (src: string, onError: () => void) => void;
}

type TimerHandle = ReturnType<typeof setTimeout>;

/** Browser dependencies, injectable so the adapter is testable without a DOM. */
export interface YouTubeVideoAdapterDeps {
  /** Resolves the `YT` namespace. Default: `loadYouTubeIframeApi` (the page-wide singleton). */
  loadApi?: () => Promise<YTNamespaceLike>;
  /** Builds the element `YT.Player` replaces with its iframe. Default: `document.createElement('div')`. */
  createHost?: () => HTMLElement;
  /** Default: the global `setTimeout`, read when the probe arms. */
  setTimeout?: (callback: () => void, ms: number) => TimerHandle;
  /** Default: the global `clearTimeout`. */
  clearTimeout?: (handle: TimerHandle) => void;
  /** Epoch ms, for the seek hint's expiry. Default: `Date.now()`. */
  now?: () => number;
}

type Subscriber = (error?: VideoAdapterError) => void;

type Intent = 'play' | 'pause';

// ============================================
// DEFAULT DEPENDENCIES (browser-only, evaluated at call time)
// ============================================

function defaultGetGlobal(): YouTubeApiGlobal {
  // No `@types/youtube`: the structural slice above is the whole contract.
  return window as unknown as YouTubeApiGlobal;
}

function defaultInjectScript(src: string, onError: () => void): void {
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.onerror = () => {
    // A failed tag must not pile up: the retry injects a fresh one.
    script.remove();
    onError();
  };
  document.head.appendChild(script);
}

function defaultCreateHost(): HTMLElement {
  return document.createElement('div');
}

function defaultSetTimeout(callback: () => void, ms: number): TimerHandle {
  return setTimeout(callback, ms);
}

function defaultClearTimeout(handle: TimerHandle): void {
  clearTimeout(handle);
}

function defaultNow(): number {
  return Date.now();
}

// ============================================
// PURE HELPERS
// ============================================

/**
 * Maps a YouTube `onError` code to the adapter error: `userMessage` is the toast
 * line, `message` the technical string for logs.
 */
export function mapYouTubeError(code: number): VideoAdapterError {
  const message = `YouTube onError ${code}`;
  switch (code) {
    case YT_ERROR_CODE.NOT_FOUND:
      return { code: ERROR_CODE.NOT_FOUND, message, userMessage: USER_MESSAGE.NOT_FOUND };
    case YT_ERROR_CODE.EMBED_DISABLED:
    case YT_ERROR_CODE.EMBED_DISABLED_DISGUISED:
      return { code: ERROR_CODE.EMBED_DISABLED, message, userMessage: USER_MESSAGE.EMBED_DISABLED };
    case YT_ERROR_CODE.PLATFORM_BLOCKED:
      return {
        code: ERROR_CODE.PLATFORM_BLOCKED,
        message,
        userMessage: USER_MESSAGE.PLATFORM_BLOCKED,
      };
    case YT_ERROR_CODE.INVALID_PARAM:
      return { code: ERROR_CODE.BAD_REQUEST, message, userMessage: USER_MESSAGE.BAD_REQUEST };
    // HTML5_ERROR (5) and every code YouTube adds later.
    default:
      return { code: ERROR_CODE.PLAYER_ERROR, message, userMessage: USER_MESSAGE.PLAYER_ERROR };
  }
}

function apiUnavailableError(): VideoAdapterError {
  return {
    code: ERROR_CODE.API_UNAVAILABLE,
    message: 'YouTube iframe_api script failed to load',
    userMessage: USER_MESSAGE.API_UNAVAILABLE,
  };
}

function playerCreateFailedError(): VideoAdapterError {
  return {
    code: ERROR_CODE.PLAYER_ERROR,
    message: 'YouTube player could not be created',
    userMessage: USER_MESSAGE.PLAYER_ERROR,
  };
}

// ============================================
// API SCRIPT LOADER (page-wide singleton)
// ============================================

/** The one in-flight or settled load. Null = none yet, or the last one failed. */
let apiPromise: Promise<YTNamespaceLike> | null = null;

/**
 * Resolves the global `YT` namespace, injecting `ROOM_VIDEO_YOUTUBE_API_SRC` at
 * most once per page: every caller shares one promise. `YT.Player` already
 * present -> resolves with no injection. A pre-existing `onYouTubeIframeAPIReady`
 * is chained, never replaced. A script error rejects AND clears the singleton, so
 * a later call retries. `deps` only matter for the call that starts the load.
 */
export function loadYouTubeIframeApi(deps: YouTubeApiLoaderDeps = {}): Promise<YTNamespaceLike> {
  if (apiPromise) return apiPromise;

  const globalScope = (deps.getGlobal ?? defaultGetGlobal)();
  const injectScript = deps.injectScript ?? defaultInjectScript;

  const existing = globalScope.YT;
  if (existing?.Player) {
    apiPromise = Promise.resolve({ Player: existing.Player });
    return apiPromise;
  }

  const promise = new Promise<YTNamespaceLike>((resolve, reject) => {
    const previousHandler = globalScope.onYouTubeIframeAPIReady;

    const handler = (): void => {
      const ready = globalScope.YT;
      if (ready?.Player) {
        resolve({ Player: ready.Player });
      } else {
        if (apiPromise === promise) apiPromise = null;
        reject(new Error('onYouTubeIframeAPIReady fired without YT.Player'));
      }
      previousHandler?.();
    };
    globalScope.onYouTubeIframeAPIReady = handler;

    injectScript(ROOM_VIDEO_YOUTUBE_API_SRC, () => {
      // Clear the singleton BEFORE rejecting so a retry started by a catch handler injects again.
      if (apiPromise === promise) apiPromise = null;
      if (globalScope.onYouTubeIframeAPIReady === handler) {
        globalScope.onYouTubeIframeAPIReady = previousHandler;
      }
      reject(new Error('YouTube iframe_api script failed to load'));
    });
  });

  apiPromise = promise;
  return promise;
}

/** Test only: forget the singleton so each test starts with no API loaded. */
export function __resetYouTubeApiForTest(): void {
  apiPromise = null;
}

// ============================================
// ADAPTER
// ============================================

export const createYouTubeVideoAdapter = ((
  container: HTMLElement,
  deps: YouTubeVideoAdapterDeps = {},
): VideoPlayerAdapter => {
  const loadApi = deps.loadApi ?? (() => loadYouTubeIframeApi());
  const createHost = deps.createHost ?? defaultCreateHost;
  const schedule = deps.setTimeout ?? defaultSetTimeout;
  const cancel = deps.clearTimeout ?? defaultClearTimeout;
  const now = deps.now ?? defaultNow;

  const subscribers = new Map<VideoAdapterEvent, Set<Subscriber>>();

  /** The live player, or null (nothing loaded, API still loading, destroyed). */
  let player: YTPlayerLike | null = null;
  /** The element handed to `YT.Player` (which swaps it for the iframe). */
  let host: HTMLElement | null = null;
  /** Bumped by every `load()` and by `destroy()`; a stale async step or callback bails. */
  let loadToken = 0;
  /** `onReady` fired: only now may any method other than `destroy` be called. */
  let isPlayerReady = false;
  let loadedVideoId: string | null = null;
  /** Last state the player reported (`UNSTARTED` for a fresh player). */
  let lastState: number = YT_PLAYER_STATE.UNSTARTED;
  /** What the room wants. `seekTo` / `cue` can start playback by themselves; this is the gate. */
  let intent: Intent = 'pause';
  /**
   * Where the video is, as far as we know, until the player reports a real state:
   * the start position of a fresh load, or the last `seek()`. Null = ask the player.
   */
  let positionHintSec: number | null = null;
  /** When `positionHintSec` was last set by `seek()` (epoch ms). */
  let positionHintSetAt = 0;
  let isMuted = false;
  let hasEmittedReady = false;
  let hasEmittedError = false;
  let probeTimer: TimerHandle | null = null;
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

  /** At most one `error` per load. */
  function failLoad(error: VideoAdapterError): void {
    if (hasEmittedError) return;
    hasEmittedError = true;
    clearProbe();
    emit('error', error);
  }

  // ------------------------------------------
  // Player access (never throws, never before ready)
  // ------------------------------------------

  function withPlayer(label: string, action: (target: YTPlayerLike) => void): void {
    if (isDestroyed || player === null || !isPlayerReady) return;
    try {
      action(player);
    } catch (thrown) {
      log.error(`${label} failed`, thrown);
    }
  }

  function readFromPlayer(label: string, read: (target: YTPlayerLike) => number): number {
    if (isDestroyed || player === null || !isPlayerReady) return 0;
    try {
      const value = read(player);
      return Number.isFinite(value) ? value : 0;
    } catch (thrown) {
      log.error(`${label} failed`, thrown);
      return 0;
    }
  }

  // ------------------------------------------
  // Autoplay probe
  // ------------------------------------------

  function clearProbe(): void {
    if (probeTimer === null) return;
    cancel(probeTimer);
    probeTimer = null;
  }

  /**
   * One timer at most: a second arm while one is running changes nothing. Judged
   * when it fires: still BUFFERING = a slow start, not a refusal.
   */
  function armProbe(): void {
    if (probeTimer !== null) return;
    probeTimer = schedule(() => {
      probeTimer = null;
      if (isDestroyed || intent !== 'play') return;
      if (lastState === YT_PLAYER_STATE.PLAYING || lastState === YT_PLAYER_STATE.BUFFERING) return;
      emit('blocked');
    }, ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS);
  }

  // ------------------------------------------
  // Player lifecycle
  // ------------------------------------------

  function isStale(token: number): boolean {
    return isDestroyed || token !== loadToken;
  }

  /** Destroy the player (removes its iframe) and the host; safe when either never existed. */
  function releasePlayer(): void {
    const current = player;
    const currentHost = host;
    player = null;
    host = null;
    isPlayerReady = false;
    lastState = YT_PLAYER_STATE.UNSTARTED;
    if (current) {
      try {
        current.destroy();
      } catch (thrown) {
        log.warn('player.destroy() failed', thrown);
      }
    }
    // Once YT swapped the host for its iframe this is a no-op on a detached node.
    currentHost?.remove();
  }

  function handleReady(token: number): void {
    if (isStale(token) || isPlayerReady || player === null) return;
    isPlayerReady = true;

    const videoId = loadedVideoId;
    if (videoId === null) return;
    const startSeconds = positionHintSec ?? 0;

    withPlayer('mute', (target) => (isMuted ? target.mute() : target.unMute()));
    if (intent === 'play') {
      withPlayer('loadVideoById', (target) => target.loadVideoById({ videoId, startSeconds }));
      armProbe();
    } else {
      withPlayer('cueVideoById', (target) => target.cueVideoById({ videoId, startSeconds }));
    }
    positionHintSec = startSeconds;

    // The start position is applied: `currentTime()` is now the real position.
    if (hasEmittedReady) return;
    hasEmittedReady = true;
    emit('ready');
  }

  function handleStateChange(token: number, state: number): void {
    if (isStale(token)) return;
    lastState = state;

    switch (state) {
      case YT_PLAYER_STATE.PLAYING:
        clearProbe();
        positionHintSec = null;
        if (intent === 'pause') {
          // Spurious start (seek / cue on a paused player): pause it, and do NOT tell the sync.
          withPlayer('pauseVideo', (target) => target.pauseVideo());
          return;
        }
        emit('playing');
        return;
      case YT_PLAYER_STATE.BUFFERING:
        // The probe stays armed: a refused autoplay can buffer, then fall back to UNSTARTED.
        positionHintSec = null;
        if (intent === 'pause') withPlayer('pauseVideo', (target) => target.pauseVideo());
        return;
      case YT_PLAYER_STATE.PAUSED:
        positionHintSec = null;
        emit('paused');
        return;
      case YT_PLAYER_STATE.ENDED:
        clearProbe();
        positionHintSec = null;
        emit('ended');
        return;
      // UNSTARTED and CUED say nothing about where the video is.
      default:
        return;
    }
  }

  function handlePlayerError(token: number, code: number): void {
    if (isStale(token)) return;
    log.warn('YouTube player error', code);
    failLoad(mapYouTubeError(code));
  }

  async function mountPlayer(token: number): Promise<void> {
    let yt: YTNamespaceLike;
    try {
      yt = await loadApi();
    } catch (thrown) {
      if (isStale(token)) return;
      log.error('YouTube API failed to load', thrown);
      failLoad(apiUnavailableError());
      return;
    }
    // A destroy() or a newer load() ran while the API was loading: build nothing.
    if (isStale(token)) return;

    try {
      const mount = createHost();
      container.appendChild(mount);
      host = mount;
      player = new yt.Player(mount, {
        width: FULL_SIZE,
        height: FULL_SIZE,
        playerVars: PLAYER_VARS,
        events: {
          onReady: () => handleReady(token),
          onStateChange: (event) => handleStateChange(token, event.data),
          onError: (event) => handlePlayerError(token, event.data),
        },
      });
    } catch (thrown) {
      log.error('YouTube player could not be created', thrown);
      releasePlayer();
      failLoad(playerCreateFailedError());
    }
  }

  // ------------------------------------------
  // Transport
  // ------------------------------------------

  function load(source: RoomVideoSource): void {
    if (isDestroyed) return;
    loadToken += 1;
    const token = loadToken;

    clearProbe();
    releasePlayer();
    loadedVideoId = null;
    intent = 'pause';
    positionHintSec = 0;
    hasEmittedReady = false;
    hasEmittedError = false;

    if (source.kind !== 'youtube') {
      failLoad({
        code: ERROR_CODE.UNSUPPORTED_SOURCE,
        message: 'Only YouTube sources are supported by this player',
      });
      return;
    }

    loadedVideoId = source.videoId;
    void mountPlayer(token);
  }

  /**
   * Never rejects and never throws. Before ready the intent is only recorded;
   * `onReady` starts playback (and the probe) then.
   */
  function play(): Promise<void> {
    if (isDestroyed) return Promise.resolve();
    intent = 'play';
    if (!isPlayerReady) return Promise.resolve();

    // The sync calls play() on every transport event: an already-running player
    // sends no new state, so arming the probe now would fake a `blocked`.
    const isRunning =
      lastState === YT_PLAYER_STATE.PLAYING || lastState === YT_PLAYER_STATE.BUFFERING;
    withPlayer('playVideo', (target) => target.playVideo());
    if (!isRunning) armProbe();
    return Promise.resolve();
  }

  function pause(): void {
    if (isDestroyed) return;
    intent = 'pause';
    clearProbe();
    withPlayer('pauseVideo', (target) => target.pauseVideo());
  }

  function seek(sec: number): void {
    if (isDestroyed || !Number.isFinite(sec)) return;
    const target = Math.max(0, sec);
    positionHintSec = target;
    positionHintSetAt = now();
    withPlayer('seekTo', (active) => {
      active.seekTo(target, true);
      // seekTo on a paused / unstarted player starts it.
      if (intent === 'pause') active.pauseVideo();
    });
  }

  function currentTime(): number {
    if (positionHintSec !== null) {
      // Not running (cued / paused / starting): the hint holds until a real state.
      if (lastState !== YT_PLAYER_STATE.PLAYING) return positionHintSec;
      // A seek on a running player: trust the target briefly, advancing with playback.
      const elapsedMs = now() - positionHintSetAt;
      if (elapsedMs < ROOM_VIDEO_YOUTUBE_SEEK_HINT_MS) return positionHintSec + elapsedMs / 1000;
      positionHintSec = null;
    }
    return readFromPlayer('getCurrentTime', (target) => target.getCurrentTime());
  }

  function duration(): number {
    const value = readFromPlayer('getDuration', (target) => target.getDuration());
    return value > 0 ? value : 0;
  }

  function setMuted(muted: boolean): void {
    if (isDestroyed) return;
    isMuted = muted;
    withPlayer('mute', (target) => (muted ? target.mute() : target.unMute()));
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
    clearProbe();
    releasePlayer();
    subscribers.clear();
  }

  return { load, play, pause, seek, currentTime, duration, setMuted, destroy, on };
}) satisfies VideoPlayerAdapterFactory;
