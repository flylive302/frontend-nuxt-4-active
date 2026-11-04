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

/** One row of `GET /api/v1/games`. */
export interface GameCatalogEntry {
  /** A STRING on the wire both ways — `POST /games/launch` 422s on a number. */
  game_id: string;
  name: string;
  category: string;
  layout: GameLayout;
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
