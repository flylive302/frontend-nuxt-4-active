/**
 * Game Catalog Composable — the picker's data (`GET /api/v1/games`).
 *
 * Data/Query role: fetch once, cache, expose. Starting a game is `useRoomGames`.
 *
 * GATE     only fetch when there is nothing usable yet
 * EXECUTE  GET /games → the curated list, `layout` already resolved by the server
 * REACT    none — the picker reads `status` and `games`
 *
 * 🔴 One fetch per component lifetime. `/games`, `/games/launch` and
 * `/games/close` share ONE per-user limit of 20 a minute (`throttle:20,1`), and
 * the picker is opened and closed freely. So:
 *   - `load()` fetches only from `idle`; every later open is free (cache), and
 *   - a failure is NOT retried on the next open — only `retry()`, which the player
 *     triggers with the "Try again" button, fetches again.
 */
import type { GameCatalogEntry, GameCatalogStatus } from '~/types/room/games';
import { createLogger } from '~/utils/logger';

const log = createLogger('[GameCatalog]');

/** Shown when the server answers 200 with something that is not a game list. */
const MALFORMED_RESPONSE_MESSAGE = 'Games are unavailable right now.';

export interface UseGameCatalogReturn {
  games: Readonly<Ref<readonly GameCatalogEntry[]>>;
  status: Readonly<Ref<GameCatalogStatus>>;
  errorMessage: Readonly<Ref<string | null>>;
  /** Fetch the catalogue unless it is already loaded, loading, or failed. */
  load: () => Promise<void>;
  /** Fetch again after a failure. A no-op in every other state. */
  retry: () => Promise<void>;
}

export function useGameCatalog(): UseGameCatalogReturn {
  const { api, normalizeError } = useApi();

  const games = ref<GameCatalogEntry[]>([]);
  const status = ref<GameCatalogStatus>('idle');
  const errorMessage = ref<string | null>(null);

  // ============================================
  // EXECUTE
  // ============================================

  async function fetchCatalog(): Promise<void> {
    status.value = 'loading';
    errorMessage.value = null;

    try {
      const response = await api<{ data: GameCatalogEntry[] }>('/games');

      if (!Array.isArray(response?.data)) {
        throw new Error(MALFORMED_RESPONSE_MESSAGE);
      }

      games.value = response.data;
      status.value = 'ready';
    } catch (error) {
      status.value = 'error';
      errorMessage.value = normalizeError(error).message;
      log.error('Failed to load the game catalogue', error);
    }
  }

  // ============================================
  // GATE → EXECUTE
  // ============================================

  async function load(): Promise<void> {
    // `ready` = cached, `loading` = already in flight, `error` = wait for retry().
    if (status.value !== 'idle') {
      return;
    }

    await fetchCatalog();
  }

  async function retry(): Promise<void> {
    if (status.value !== 'error') {
      return;
    }

    await fetchCatalog();
  }

  return {
    games: readonly(games),
    status: readonly(status),
    errorMessage: readonly(errorMessage),
    load,
    retry,
  };
}
