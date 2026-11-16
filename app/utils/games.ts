/**
 * Games (JoyPlay and Fly) — pure layout, placement and URL decisions.
 *
 * No Vue, no stores: the composable and the components both read these, and the
 * tests exercise them directly.
 */
import {
  GAME_ICON_BASE_PATH,
  GAME_ICON_EXTENSION,
  GAME_SHEET_PANEL_CLASS,
} from '~/constants/games';
import type {
  GameCatalogEntry,
  GameContainer,
  GameLayout,
  GamePlace,
  GameProvider,
} from '~/types/room/games';

/**
 * Which container a game's layout renders in.
 *
 * `full` is a full-viewport overlay. `half` and `tall` are bottom-sheet panels
 * that differ only in aspect ratio. An unrecognised layout (the server grew a
 * value this bundle predates) degrades to the `half` sheet — the shortest, safest
 * panel — rather than throwing in the middle of a render.
 */
export function resolveGameContainer(layout: GameLayout): GameContainer {
  if (layout === 'full') {
    return { mode: 'overlay' };
  }

  return {
    mode: 'sheet',
    panelClass: GAME_SHEET_PANEL_CLASS[layout] ?? GAME_SHEET_PANEL_CLASS.half,
  };
}

/**
 * A Fly game's origin as `scheme://host[:port]`, or `null` if it is not one.
 *
 * The same string is the iframe `src`, the exact `event.origin` every inbound
 * message must match, and the `targetOrigin` of every outbound one — so it is
 * normalised once here. The server already sends this form; anything with a path,
 * query, fragment, credentials or a non-http(s) scheme is refused rather than
 * trimmed, because guessing which part was meant would loosen the origin GATE.
 */
export function normalizeGameOrigin(origin: string | null | undefined): string | null {
  if (typeof origin !== 'string' || origin === '') {
    return null;
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }

  const isHttp = url.protocol === 'https:' || url.protocol === 'http:';
  // Equal to its own origin (one trailing slash allowed) ⇒ no path, query,
  // fragment, credentials or written-out default port.
  const isBareOrigin = origin.replace(/\/$/, '') === url.origin;

  return isHttp && isBareOrigin ? url.origin : null;
}

/**
 * Which launch path a catalogue row takes, or `null` for a provider this bundle
 * does not know (never launched — sending it down JoyPlay's path would be wrong).
 * No `provider` at all is a backend from before fly-games-ludo 01: JoyPlay.
 */
export function gameProviderOf(game: GameCatalogEntry): GameProvider | null {
  switch (game.provider ?? 'joyplay') {
    case 'joyplay':
      return 'joyplay';
    case 'fly':
      return 'fly';
    default:
      return null;
  }
}

/**
 * Whether the app may offer `game` at `place`.
 *
 * - Unknown provider → never. A provider this bundle predates has a launch path it
 *   does not have; offering it would send it down the JoyPlay one.
 * - No `places` (a backend from before fly-games-ludo 03) → JoyPlay in the Room
 *   lobby only, exactly what that backend offered.
 * - A Fly game also needs a usable origin, or there is nothing to load.
 */
export function isGameOfferedIn(game: GameCatalogEntry, place: GamePlace): boolean {
  switch (gameProviderOf(game)) {
    case 'fly':
      return (game.places ?? []).includes(place) && normalizeGameOrigin(game.origin) !== null;
    case 'joyplay':
      return game.places ? game.places.includes(place) : place === 'room_lobby';
    default:
      return false;
  }
}

/**
 * URL of a game's icon in `public/`. The file may not exist yet — the caller
 * shows a text tile until the image actually loads.
 */
export function gameIconUrl(gameId: string): string {
  return `${GAME_ICON_BASE_PATH}/${encodeURIComponent(gameId)}.${GAME_ICON_EXTENSION}`;
}
