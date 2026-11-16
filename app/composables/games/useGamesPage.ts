/**
 * Games page — the Fly games grid on the Discover page (fly-games-ludo 05).
 *
 * Orchestrator for `GamesDiscoverSection`. The catalogue, the postMessage
 * protocol and the full-screen shell already exist (Room lobby, 04); this file
 * only wires them for a surface that has NO Room.
 *
 * GATE     section visible only when the catalogue is `ready` AND has a launchable game;
 *          a tapped game must be a Fly game (JoyPlay needs a Room)
 * EXECUTE  load the catalogue once on mount; open / close the Fly bridge
 * REACT    none here — the bridge reacts to its own game's messages
 *
 * Nothing is shown while loading, on error or when empty: a player who has no
 * `games_page` game must see the Discover page exactly as it was.
 *
 * ⛔ No wealth-level / `canPlay` gate on this surface — the server rollout is the
 * gate (the Room games button owns the wealth gate).
 *
 * 🔴 `/games` shares ONE 20/min per-user limit with launch/close. The catalogue is
 * fetched once per mount and never polled or re-fetched when a game opens or closes.
 */
import { useFlyGameBridge } from '~/composables/games/useFlyGameBridge';
import { useBackDismiss } from '~/composables/shared/useBackDismiss';
import { useGameCatalog } from '~/composables/room/useGameCatalog';
import { GAME_PANEL_TITLE } from '~/constants/games';
import type { GameCatalogEntry, GamePanelStatus } from '~/types/room/games';
import { gameProviderOf } from '~/utils/games';
import { createLogger } from '~/utils/logger';

const log = createLogger('[GamesPage]');

export interface UseGamesPageReturn {
  /** The games to draw as tiles: offered at `games_page` AND launchable here (Fly). */
  games: ComputedRef<readonly GameCatalogEntry[]>;
  /** Whether the section renders at all. False while loading, on error and when empty. */
  isSectionVisible: ComputedRef<boolean>;
  /** Whether the full-screen game layer is up. */
  isOverlayOpen: ComputedRef<boolean>;
  gameTitle: ComputedRef<string>;
  status: Readonly<Ref<GamePanelStatus>>;
  gameUrl: Readonly<Ref<string | null>>;
  errorMessage: Readonly<Ref<string | null>>;
  frame: Ref<HTMLIFrameElement | null>;
  /** A tile was tapped. */
  selectGame: (game: GameCatalogEntry) => void;
  /** ← / ✕ / Android back: end the game and stay on the page. */
  closeGame: () => void;
  retry: () => Promise<void>;
  onFrameLoaded: () => void;
}

export function useGamesPage(): UseGamesPageReturn {
  const { games: offered, status: catalogStatus, load: loadCatalog } = useGameCatalog({
    place: 'games_page',
  });

  const {
    status,
    gameUrl,
    errorMessage,
    currentGame,
    frame,
    open,
    retry,
    close,
    onFrameLoaded,
  } = useFlyGameBridge({
    // No `roomId`: opened from here, no `room` message is ever posted.
    // The game's own `return_to_room` ends the session inside the bridge; this
    // keeps the surface in step. The player stays on Discover.
    onExitRequested: closeGame,
  });

  // JoyPlay needs a Room, so a JoyPlay row placed at `games_page` would be a dead tile.
  const games = computed<readonly GameCatalogEntry[]>(() =>
    offered.value.filter((game) => gameProviderOf(game) === 'fly'),
  );

  const isSectionVisible = computed(() => catalogStatus.value === 'ready' && games.value.length > 0);

  // Always full-screen here: the layer is up whenever a game is open, whatever the
  // game's own `layout` says (the bridge's `container` is not consulted).
  const isOverlayOpen = computed(() => currentGame.value !== null);
  const gameTitle = computed(() => currentGame.value?.name ?? GAME_PANEL_TITLE);

  // ============================================
  // GATE → EXECUTE
  // ============================================

  function selectGame(game: GameCatalogEntry): void {
    if (gameProviderOf(game) !== 'fly') {
      log.warn('Ignored a non-Fly game on the Games page', game.game_id, game.provider);
      return;
    }

    open(game);
  }

  // ============================================
  // EXECUTE
  // ============================================

  function closeGame(): void {
    close();
  }

  // The full-screen layer is a raw Teleport, not a Reka layer, so the Android back
  // button's Escape dispatch cannot see it. Register it, or back would navigate
  // away from Discover with the game still up.
  useBackDismiss(isOverlayOpen, closeGame);

  onMounted(() => {
    void loadCatalog();
  });

  // The bridge's own unmount hook only drops its listener and resets the session;
  // it never closes. Leaving the page ends the game.
  onBeforeUnmount(closeGame);

  return {
    games,
    isSectionVisible,
    isOverlayOpen,
    gameTitle,
    status,
    gameUrl,
    errorMessage,
    frame,
    selectGame,
    closeGame,
    retry,
    onFrameLoaded,
  };
}
