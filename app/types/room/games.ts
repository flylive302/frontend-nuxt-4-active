/**
 * JoyPlay games panel — types only, no runtime code.
 */

/** What `POST /api/v1/games/launch` returns. */
export interface GameLaunchResponse {
  url: string;
  expires_at: string;
}

/** Where the panel is in its lifecycle, for the component to render against. */
export type GamePanelStatus =
  | 'idle'
  | 'launching'
  | 'loading'
  | 'ready'
  | 'error';

/**
 * How tall the vendor renders a game, as the server resolved it
 * (`GET /games` → `layout`). Already the EFFECTIVE layout — the server maps a
 * catalogue entry to what it will actually launch, so the client never re-derives it.
 */
export type GameLayout = 'full' | 'half' | 'tall';

/**
 * Who hosts a game and how it logs the player in.
 *
 * - `joyplay` — `POST /games/launch` returns an iframe URL carrying a session token.
 * - `fly`     — the iframe loads the bare game origin; a launch token is handed over
 *               by `postMessage` after the game says `ready` (`useFlyGameBridge`).
 */
export type GameProvider = 'joyplay' | 'fly';

/** Where the app may offer a game (`GET /games` → `places`). */
export type GamePlace = 'room_lobby' | 'games_page';

/** One row of `GET /api/v1/games`. */
export interface GameCatalogEntry {
  /** A STRING on the wire both ways — `POST /games/launch` 422s on a number. */
  game_id: string;
  name: string;
  category: string;
  layout: GameLayout;
  /**
   * Optional because a backend from before fly-games-ludo 01/03 omits them. A row
   * without them is a JoyPlay game offered in the Room lobby only — see
   * `isGameOfferedIn`. `provider` is a plain string on the wire: a value this
   * bundle does not know is hidden, never launched down the wrong path.
   */
  provider?: GameProvider | (string & {});
  places?: readonly (GamePlace | (string & {}))[];
  /**
   * Fly games only: `scheme://host[:port]`. The frame src and postMessage origin of
   * a game at its origin root. `null` for a Fly game on a path — see `launch_url`.
   */
  origin?: string | null;
  /**
   * Fly games only: the URL the game frame loads — the origin, plus a path when
   * several games share one origin (`…/carrom`). Optional because a backend from
   * before it omits it; then `origin` is the URL. Read both through
   * `resolveFlyGameTarget`, never directly.
   */
  launch_url?: string | null;
}

/** Where a Fly game loads and which origin its messages are matched against. */
export interface FlyGameTarget {
  /** Bare `scheme://host[:port]` — the postMessage GATE and `targetOrigin`. */
  origin: string;
  /** The frame `src`. Equals `origin` for a game at its origin root. */
  url: string;
}

/** Where the catalogue fetch is, for the picker to render against. */
export type GameCatalogStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

/**
 * Where a game is rendered.
 *
 * - `sheet`   — inside the bottom drawer, in a panel with the given aspect classes.
 * - `overlay` — a full-viewport layer over the room (never inside the drawer).
 */
export type GameContainer =
  | { mode: 'sheet'; panelClass: string }
  | { mode: 'overlay' };
