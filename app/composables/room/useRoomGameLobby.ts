/**
 * Room Game Lobby — one games surface, two providers.
 *
 * Orchestrator for the Room games drawer. It owns no protocol itself: a picked
 * game goes to the launcher for its provider, and the surface reads whichever
 * one is open.
 *
 *   joyplay (or no provider — a pre-fly-games backend)  → useRoomGames
 *   fly                                                 → useFlyGameBridge (+ this Room's id)
 *   anything else                                       → refused (never JoyPlay's path)
 *
 * GATE     the Room games button gate (`canPlay`, from useRoomGames) for every provider
 * EXECUTE  dispatch open / retry; close BOTH (each is a no-op when it has nothing open)
 * REACT    none here — each launcher reacts to its own game's messages
 *
 * Both launchers post through ONE shared iframe ref: only one game is ever open.
 * A Fly game never touches `/games/launch` or `/games/close`, and nothing here
 * touches the Seat or the Room audio.
 */
import type {
  GameCatalogEntry,
  GameContainer,
  GamePanelStatus,
} from '~/types/room/games';
import { useFlyGameBridge } from '~/composables/games/useFlyGameBridge';
import { useRoomGames } from '~/composables/room/useRoomGames';
import { gameProviderOf } from '~/utils/games';
import { createLogger } from '~/utils/logger';

const log = createLogger('[RoomGameLobby]');

export interface UseRoomGameLobbyOptions {
  /** A game asked to leave (JoyPlay exit/recharge, Fly `return_to_room`). Close the surface. */
  onExitRequested?: () => void;
}

export interface UseRoomGameLobbyReturn {
  status: ComputedRef<GamePanelStatus>;
  gameUrl: ComputedRef<string | null>;
  errorMessage: ComputedRef<string | null>;
  currentGame: ComputedRef<Readonly<GameCatalogEntry> | null>;
  container: ComputedRef<GameContainer | null>;
  isFullScreen: ComputedRef<boolean>;
  canPlay: ComputedRef<boolean>;
  frame: Ref<HTMLIFrameElement | null>;
  open: (game: GameCatalogEntry) => Promise<void>;
  retry: () => Promise<void>;
  close: () => Promise<void>;
  onFrameLoaded: () => void;
}

export function useRoomGameLobby(options: UseRoomGameLobbyOptions = {}): UseRoomGameLobbyReturn {
  const roomStore = useRoomStore();
  const frame = ref<HTMLIFrameElement | null>(null);

  const joyplay = useRoomGames({ frame, onExitRequested: options.onExitRequested });
  const fly = useFlyGameBridge({
    frame,
    roomId: () => roomStore.currentRoom?.id ?? null,
    onExitRequested: options.onExitRequested,
  });

  /** The launcher whose game is open. JoyPlay while nothing is (its idle state is the picker's). */
  const active = computed(() => (fly.currentGame.value ? fly : joyplay));

  // ============================================
  // GATE + EXECUTE
  // ============================================

  async function open(game: GameCatalogEntry): Promise<void> {
    // The Room games button gate covers every provider in the Room lobby.
    if (!joyplay.canPlay.value) {
      return;
    }

    switch (gameProviderOf(game)) {
      case 'fly':
        fly.open(game);
        return;
      case 'joyplay':
        await joyplay.open(game);
        return;
      default:
        log.warn('Refused a game with an unknown provider', game.game_id, game.provider);
    }
  }

  async function retry(): Promise<void> {
    await active.value.retry();
  }

  async function close(): Promise<void> {
    fly.close();
    await joyplay.close();
  }

  function onFrameLoaded(): void {
    active.value.onFrameLoaded();
  }

  return {
    status: computed(() => active.value.status.value),
    gameUrl: computed(() => active.value.gameUrl.value),
    errorMessage: computed(() => active.value.errorMessage.value),
    currentGame: computed(() => active.value.currentGame.value),
    container: computed(() => active.value.container.value),
    isFullScreen: computed(() => active.value.isFullScreen.value),
    canPlay: joyplay.canPlay,
    frame,
    open,
    retry,
    close,
    onFrameLoaded,
  };
}
