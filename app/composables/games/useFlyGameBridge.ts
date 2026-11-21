/**
 * Fly Game Bridge — the postMessage protocol for ONE open Fly game (Ludo first).
 *
 * Action role, not tied to a Room: the Room games lobby passes a `roomId`, the
 * Games page (fly-games-ludo 05) passes none.
 *
 *   open(game)   GATE  Fly provider + usable target (`resolveFlyGameTarget`)
 *                EXECUTE load the game's launch URL in the frame — the bare origin,
 *                plus a path for a game that shares its origin (Carrom at `/carrom`).
 *                No token in any URL.
 *   message      GATE  exact BARE origin + this frame's window + `source: flylive-ludo`
 *                (`flylive-ludo` is the Fly site's name, sent by every game on it)
 *     ready        → POST /games/fly/token → post `launch`, then `room` (Room only)
 *     launch_result → ok: ready · not ok: error state (Retry reloads the frame)
 *     return_to_room → close, ask the surface to close
 *     request_fullscreen → full-screen layout
 *     anything else → ignored (Fly will add `coins` / `closed`)
 *
 * Protocol: docs/reference/fly-games/vendor-messages.md §4 — the Fly team's,
 * already built on their side. Spec: prd-fly-games-ludo.md § Frontend.
 *
 * ⛔ No load timeout. The only failures are a failed mint and `launch_result
 * ok:false` — see the JoyPlay timeout post-mortem in `constants/games.ts`.
 */
import type { GameCatalogEntry, GameContainer, GamePanelStatus } from '~/types/room/games';
import type {
  FlyGameInboundMessage,
  FlyGameOutboundMessage,
  FlyGameTokenResponse,
} from '~/types/games/fly-games';
import {
  FLY_GAME_LOGIN_FAILED_MESSAGE,
  FLY_GAME_MESSAGE_IN,
  FLY_GAME_MESSAGE_OUT,
  FLY_GAME_MIN_MINT_INTERVAL_MS,
  FLY_GAME_SOURCE_IN,
  FLY_GAME_SOURCE_OUT,
  FLY_GAME_UNAVAILABLE_MESSAGE,
} from '~/constants/fly-games';
import { gameProviderOf, resolveFlyGameTarget, resolveGameContainer } from '~/utils/games';
import { createLogger } from '~/utils/logger';

const log = createLogger('[FlyGameBridge]');

export interface UseFlyGameBridgeOptions {
  /** The iframe element, owned by the surface (shared with JoyPlay in the Room lobby). */
  frame?: Ref<HTMLIFrameElement | null>;
  /** The Room the game was opened from, read at send time. `null` → no `room` message. */
  roomId?: () => string | number | null | undefined;
  /** The game asked to leave (`return_to_room`). The surface closes itself. */
  onExitRequested?: () => void;
}

export interface UseFlyGameBridgeReturn {
  status: Readonly<Ref<GamePanelStatus>>;
  /** The game's launch URL (origin, plus a path for some games) while it is open. Never carries a token. */
  gameUrl: Readonly<Ref<string | null>>;
  errorMessage: Readonly<Ref<string | null>>;
  currentGame: Readonly<Ref<Readonly<GameCatalogEntry> | null>>;
  container: ComputedRef<GameContainer | null>;
  isFullScreen: ComputedRef<boolean>;
  frame: Ref<HTMLIFrameElement | null>;
  open: (game: GameCatalogEntry) => void;
  retry: () => Promise<void>;
  close: () => void;
  /** The iframe `load` event. Not a readiness signal here — `launch_result` is. */
  onFrameLoaded: () => void;
}

export function useFlyGameBridge(options: UseFlyGameBridgeOptions = {}): UseFlyGameBridgeReturn {
  const { api, normalizeError } = useApi();

  const frame = options.frame ?? ref<HTMLIFrameElement | null>(null);
  const status = ref<GamePanelStatus>('idle');
  const gameUrl = ref<string | null>(null);
  const errorMessage = ref<string | null>(null);
  const currentGame = ref<GameCatalogEntry | null>(null);
  const fullScreenRequested = ref(false);

  /** The bare origin of the open game: the GATE and the targetOrigin. Never the frame src. */
  let origin: string | null = null;

  /** What the frame loads for the open game — `origin`, or `origin` plus the game's path. */
  let launchUrl: string | null = null;

  /**
   * Advanced by open, retry and close. A mint answer is used only if this still
   * holds the value it had when the request went out — a token for a game the
   * player already left, or for the frame before a reload, is dropped.
   */
  let sessionSeq = 0;

  // Mint throttle: leading edge + in-flight guard + one trailing answer.
  let mintInFlight = false;
  let lastMintAt = Number.NEGATIVE_INFINITY;
  let readyPending = false;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;

  const container = computed<GameContainer | null>(() => {
    if (!currentGame.value) {
      return null;
    }

    return fullScreenRequested.value
      ? { mode: 'overlay' }
      : resolveGameContainer(currentGame.value.layout);
  });

  const isFullScreen = computed<boolean>(() => container.value?.mode === 'overlay');

  // ============================================
  // GATE
  // ============================================

  /**
   * Every inbound message passes all three or is dropped silently:
   * exact origin, THIS frame's window (read now — a reload swaps it), and
   * `source: flylive-ludo`. Any one alone is forgeable by another frame.
   */
  function acceptMessage(event: MessageEvent): FlyGameInboundMessage | null {
    if (!currentGame.value || !origin || event.origin !== origin) {
      return null;
    }

    const gameWindow = frame.value?.contentWindow;
    if (!gameWindow || event.source !== gameWindow) {
      return null;
    }

    const data: unknown = event.data;
    if (typeof data !== 'object' || data === null) {
      return null;
    }

    const message = data as Partial<FlyGameInboundMessage>;
    if (message.source !== FLY_GAME_SOURCE_IN || typeof message.type !== 'string') {
      return null;
    }

    return message as FlyGameInboundMessage;
  }

  // ============================================
  // EXECUTE
  // ============================================

  function open(game: GameCatalogEntry): void {
    if (gameProviderOf(game) !== 'fly') {
      log.warn('Refused to open a non-Fly game in the Fly bridge', game.game_id);
      return;
    }

    resetSession();
    currentGame.value = game;
    const target = resolveFlyGameTarget(game);

    if (!target) {
      // A game may already be open (the surfaces call open() without close()):
      // drop its frame too, or the panel errors over another game's page.
      origin = null;
      launchUrl = null;
      gameUrl.value = null;
      status.value = 'error';
      errorMessage.value = FLY_GAME_UNAVAILABLE_MESSAGE;
      log.error('Fly game has no usable launch target', game.game_id);
      return;
    }

    origin = target.origin;
    launchUrl = target.url;
    gameUrl.value = launchUrl;
    status.value = 'launching';
  }

  /** "Try again": reload the frame. The reloaded game sends `ready` and the flow restarts. */
  async function retry(): Promise<void> {
    const game = currentGame.value;
    if (!game || !launchUrl) {
      return;
    }

    const url = launchUrl;
    resetSession();
    status.value = 'launching';
    // Unmount the iframe for one tick so it remounts and loads afresh — the same
    // `src` string set again would not navigate.
    gameUrl.value = null;
    const seq = sessionSeq;
    await nextTick();

    if (seq === sessionSeq && currentGame.value === game) {
      gameUrl.value = url;
    }
  }

  function close(): void {
    resetSession();
    currentGame.value = null;
    origin = null;
    launchUrl = null;
    gameUrl.value = null;
    status.value = 'idle';
  }

  /** Mint a fresh token for the open game and hand it over. */
  async function mintAndLaunch(): Promise<void> {
    const game = currentGame.value;
    const target = origin;
    if (!game || !target) {
      return;
    }

    const seq = sessionSeq;
    mintInFlight = true;
    lastMintAt = Date.now();
    readyPending = false;

    try {
      const response = await api<{ data: FlyGameTokenResponse }>('/games/fly/token', {
        method: 'POST',
        body: { game_id: String(game.game_id) },
      });

      if (seq !== sessionSeq) {
        log.debug('Discarded a stale Fly launch token', game.game_id);
        return;
      }

      const token = response?.data?.token;
      if (typeof token !== 'string' || token === '') {
        throw new Error(FLY_GAME_UNAVAILABLE_MESSAGE);
      }

      postToGame({ source: FLY_GAME_SOURCE_OUT, type: FLY_GAME_MESSAGE_OUT.LAUNCH, token }, target);

      const roomId = options.roomId?.();
      if (roomId !== null && roomId !== undefined && roomId !== '') {
        postToGame({ source: FLY_GAME_SOURCE_OUT, type: FLY_GAME_MESSAGE_OUT.ROOM, roomId: String(roomId) }, target);
      }
    } catch (error) {
      if (seq !== sessionSeq) {
        return;
      }

      fail(normalizeError(error).message);
      log.error('Failed to mint a Fly launch token', error);
    } finally {
      if (seq === sessionSeq) {
        mintInFlight = false;
        if (readyPending) {
          onReady();
        }
      }
    }
  }

  // ============================================
  // REACT
  // ============================================

  function handleMessage(event: MessageEvent): void {
    const message = acceptMessage(event);
    if (!message) {
      return;
    }

    switch (message.type) {
      case FLY_GAME_MESSAGE_IN.READY:
        onReady();
        break;

      case FLY_GAME_MESSAGE_IN.LAUNCH_RESULT:
        if (message.ok === true) {
          status.value = 'ready';
          errorMessage.value = null;
        } else {
          fail(FLY_GAME_LOGIN_FAILED_MESSAGE);
          log.warn('Fly game refused the launch token', message.reason);
        }
        break;

      case FLY_GAME_MESSAGE_IN.RETURN_TO_ROOM:
        close();
        options.onExitRequested?.();
        break;

      case FLY_GAME_MESSAGE_IN.REQUEST_FULLSCREEN:
        fullScreenRequested.value = true;
        break;

      default:
        log.debug('Unhandled Fly game message', message.type);
    }
  }

  /**
   * Every `ready` gets a fresh token (Fly's session expiry re-sends it), but a
   * frame stuck in a loop must not drain the shared per-user limit. A `ready`
   * during a mint or inside the interval is remembered and answered once, when
   * the window ends — never dropped, or a game that genuinely reloaded would
   * wait forever.
   */
  function onReady(): void {
    if (mintInFlight) {
      readyPending = true;
      return;
    }

    const wait = lastMintAt + FLY_GAME_MIN_MINT_INTERVAL_MS - Date.now();
    if (wait > 0) {
      readyPending = true;
      readyTimer ??= setTimeout(() => {
        readyTimer = null;
        if (readyPending) {
          onReady();
        }
      }, wait);
      return;
    }

    void mintAndLaunch();
  }

  /** A re-login under a live board stays silent; only a failure changes what is shown. */
  function fail(message: string): void {
    status.value = 'error';
    errorMessage.value = message;
  }

  // ============================================
  // Helpers
  // ============================================

  /** Always the exact game origin as targetOrigin — never `*`. */
  function postToGame(message: FlyGameOutboundMessage, target: string): void {
    frame.value?.contentWindow?.postMessage(message, target);
  }

  function resetSession(): void {
    sessionSeq += 1;
    mintInFlight = false;
    readyPending = false;
    lastMintAt = Number.NEGATIVE_INFINITY;
    if (readyTimer !== null) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }
    fullScreenRequested.value = false;
    errorMessage.value = null;
  }

  function onFrameLoaded(): void {
    // Intentionally nothing: the iframe `load` says nothing about the login.
  }

  onMounted(() => window.addEventListener('message', handleMessage));

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleMessage);
    resetSession();
  });

  return {
    status: readonly(status),
    gameUrl: readonly(gameUrl),
    errorMessage: readonly(errorMessage),
    currentGame: readonly(currentGame),
    container,
    isFullScreen,
    frame,
    open,
    retry,
    close,
    onFrameLoaded,
  };
}
