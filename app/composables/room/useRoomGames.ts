/**
 * Room Games Composable — the brain behind the JoyPlay panel.
 *
 * GATE → EXECUTE → REACT, in that order:
 *   GATE     signed in, in a room, feature reachable
 *   EXECUTE  POST /games/launch → an iframe URL carrying a one-shot session token
 *   REACT    postMessage bridge: their events in, balance-changed out
 *
 * The component that uses this owns nothing but markup and bindings.
 *
 * Design: docs/issues/game-integration/03-joyplay-integration-design.md §3.5
 */
import type { GameLaunchResponse, GamePanelStatus } from '~/types/room/games';
import { GAME_MESSAGE_IN, GAME_MESSAGE_OUT } from '~/constants/games';
import { createLogger } from '~/utils/logger';

const log = createLogger('[RoomGames]');

export interface UseRoomGamesOptions {
  /**
   * Called when the panel must close itself — the player tapped the game's own
   * exit button, or asked to top up.
   *
   * The composable can end the SESSION but cannot close the DRAWER: `open` is a
   * `defineModel` owned by the component. Without this, tapping in-game exit tears
   * down the iframe and leaves the player staring at an empty square they have to
   * dismiss by hand.
   */
  onExitRequested?: () => void;
}

export interface UseRoomGamesReturn {
  status: Readonly<Ref<GamePanelStatus>>;
  gameUrl: Readonly<Ref<string | null>>;
  errorMessage: Readonly<Ref<string | null>>;
  canPlay: ComputedRef<boolean>;
  frame: Ref<HTMLIFrameElement | null>;
  open: () => Promise<void>;
  close: () => Promise<void>;
  notifyBalanceChanged: () => void;
  onFrameLoaded: () => void;
}

export function useRoomGames(options: UseRoomGamesOptions = {}): UseRoomGamesReturn {
  const { api, normalizeError } = useApi();
  const authStore = useAuthStore();
  const bootstrapStore = useBootstrapStore();
  const roomStore = useRoomStore();
  const router = useRouter();

  const status = ref<GamePanelStatus>('idle');
  const gameUrl = ref<string | null>(null);
  const errorMessage = ref<string | null>(null);
  const frame = ref<HTMLIFrameElement | null>(null);

  /**
   * The origin we will accept messages from, derived from the launch URL rather
   * than hard-coded.
   *
   * JoyPlay run two estates on different hosts (joysdk.com and joyplay.cn) and the
   * server decides which one we are on. Duplicating that choice in the client is a
   * second source of truth that can silently drift — and if it drifts, the panel
   * stops responding to the game with no error anywhere.
   */
  const vendorOrigin = computed<string | null>(() => {
    if (!gameUrl.value) {
      return null;
    }

    try {
      return new URL(gameUrl.value).origin;
    } catch {
      return null;
    }
  });

  // ============================================
  // GATE
  // ============================================

  /**
   * `gamesEnabled` comes from bootstrap and defaults to false, so the button does
   * not render until the server says the integration is live. Without it the panel
   * is visible while the kill switch is off and every tap ends in an error.
   */
  const canPlay = computed<boolean>(
    () => Boolean(authStore.user?.id) && bootstrapStore.gamesEnabled,
  );

  // ============================================
  // EXECUTE
  // ============================================

  async function open(): Promise<void> {
    if (!canPlay.value || status.value === 'launching') {
      return;
    }

    status.value = 'launching';
    errorMessage.value = null;

    try {
      const response = await api<{ data: GameLaunchResponse }>('/games/launch', {
        method: 'POST',
        body: { room_id: roomStore.currentRoom?.id ?? null },
      });

      gameUrl.value = response.data.url;
      status.value = 'loading';
    } catch (error) {
      status.value = 'error';
      errorMessage.value = normalizeError(error).message;
      log.error('Failed to open the games panel', error);
    }
  }

  async function close(): Promise<void> {
    gameUrl.value = null;
    status.value = 'idle';
    errorMessage.value = null;

    // Best-effort. The server never depends on this arriving — the session row
    // carries its own expiry precisely because a force-quit or a dropped network
    // means we may never get here.
    try {
      await api('/games/close', { method: 'POST' });
    } catch (error) {
      log.warn('Could not tell the server the games panel closed', error);
    }
  }

  // ============================================
  // REACT
  // ============================================

  /**
   * Tell the game to re-read the balance from our API.
   *
   * Call after anything that moves coins outside the game — a recharge, a reward,
   * a gift received. Without it the game keeps showing a stale number until the
   * next round.
   *
   * ⛔ CURRENTLY A NO-OP, AND NOT BECAUSE OF THIS CODE. Do not "fix" it here.
   *
   * JoyPlay install their inbound listener per partner. Partners they have not
   * compiled in — us — fall to a default branch guarded by
   * `e.origin === location.origin`, which inside their iframe means
   * "https://joyplay.cn". A cross-origin iframe can never satisfy that, so every
   * message we post is dropped and logged as `origin` in their console. Every
   * partner-specific listener omits the check; only the fall-through has it.
   *
   * We cannot inject into a cross-origin frame, and the string we send is already
   * the one their spec documents, so there is nothing on our side to change. Asked
   * them to drop the guard for our appKey on 2026-08-04.
   *
   * Kept live deliberately: it starts working the moment they ship, with no
   * release of ours. Root cause and the exact source lines are in
   * docs/issues/game-integration/03-joyplay-integration-design.md.
   */
  function notifyBalanceChanged(): void {
    const origin = vendorOrigin.value;

    if (!frame.value?.contentWindow || !origin) {
      return;
    }

    frame.value.contentWindow.postMessage(GAME_MESSAGE_OUT.BALANCE_CHANGED, origin);
  }

  function handleMessage(event: MessageEvent): void {
    // Their spec sends `"*"` as the target origin on the way out. That is their
    // choice for their own messages; on the way IN it is our exposure, so every
    // message is checked against the origin the server actually handed us.
    if (!vendorOrigin.value || event.origin !== vendorOrigin.value) {
      return;
    }

    if (typeof event.data !== 'string') {
      return;
    }

    switch (event.data) {
      case GAME_MESSAGE_IN.OPEN_GAME_SUCCESS:
        status.value = 'ready';
        break;

      case GAME_MESSAGE_IN.CLOSE:
        void close();
        options.onExitRequested?.();
        break;

      // Both mean "the player wants to top up" — one from tapping the balance,
      // one from failing to cover a stake. We own recharge (`noPay=1` hides
      // theirs), so both land on our page.
      case GAME_MESSAGE_IN.CLICK_RECHARGE:
      case GAME_MESSAGE_IN.RECHARGE:
        void goToRecharge();
        break;

      default:
        log.debug('Unhandled game message', event.data);
    }
  }

  async function goToRecharge(): Promise<void> {
    await close();
    options.onExitRequested?.();
    await router.push('/recharge');
  }

  /**
   * Push a balance change into the running game.
   *
   * `getUserInfo` fires ONCE, at launch. Without this, a gift received or a reward
   * claimed while the panel is open leaves the in-game number stale for the whole
   * session, and the player's next stake fails against a balance they cannot see.
   *
   * Guarded only on the frame existing, not on a readiness status. We have no
   * trustworthy readiness signal (see `onFrameLoaded`), and a message posted a
   * moment too early is silently dropped by the browser — while one we decline to
   * send leaves the player looking at a stale number.
   */
  watch(
    () => authStore.user?.coins,
    (next, previous) => {
      if (next === previous) {
        return;
      }

      notifyBalanceChanged();
    },
  );

  /**
   * The iframe document finished loading.
   *
   * ⚠️ Best-effort only. An iframe `load` waits for every subresource, and a Cocos
   * bundle is tens of megabytes — on 2026-08-04 it had not fired 20 seconds after
   * the game was already spinning. So this marks readiness when it arrives, and
   * nothing depends on it arriving promptly.
   *
   * 🔴 There is NO reliable readiness signal from this game. `OpenGameSucc` is
   * logged internally by their build and never posted to us, and `load` is far too
   * late. That is why the old 20-second failure timeout was deleted — see below.
   */
  function onFrameLoaded(): void {
    if (status.value !== 'loading') {
      return;
    }

    status.value = 'ready';
  }

  /*
   * ⛔ DELETED 2026-08-04: the load-failure timeout. Do not add it back.
   *
   * It flipped us to `error` 20 seconds after launch unless something signalled
   * readiness. Nothing reliably does — so the overlay appeared ON TOP of a game
   * the player was actively spinning, telling them "The game did not load" while
   * their bets settled correctly underneath it. A false failure on a working game
   * is strictly worse than no message at all.
   *
   * We also cannot fix it by extending the timer: there is no duration that
   * separates "slow bundle on 3G" from "genuinely broken", and guessing wrong in
   * the safe direction is exactly what produced the bug.
   *
   * Nothing is lost by removing it. A launch that actually fails throws in
   * `open()` and is caught there, and a game that fails after launching renders
   * its OWN error — "Your information has expired", with a Reboot button — which
   * is more specific than anything we could show.
   */

  onMounted(() => window.addEventListener('message', handleMessage));

  onBeforeUnmount(() => window.removeEventListener('message', handleMessage));

  return {
    status: readonly(status),
    gameUrl: readonly(gameUrl),
    errorMessage: readonly(errorMessage),
    canPlay,
    frame,
    open,
    close,
    notifyBalanceChanged,
    onFrameLoaded,
  };
}
