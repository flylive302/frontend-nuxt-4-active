/**
 * Fly Games (Ludo first) — static values.
 *
 * postMessage protocol: docs/reference/fly-games/vendor-messages.md §4 (the Fly
 * team's, already built on their side — do not rename anything here without them).
 */

/** `source` on every message the game posts to us. */
export const FLY_GAME_SOURCE_IN = 'flylive-ludo';

/** `source` on every message we post to the game. */
export const FLY_GAME_SOURCE_OUT = 'flylive';

/** Message types the game sends up. Anything else is ignored (Fly will add `coins` / `closed`). */
export const FLY_GAME_MESSAGE_IN = {
  /** The game is listening — mint a fresh token and post `launch`. Re-sent when its session expires. */
  READY: 'ready',
  /** Outcome of the last `launch`: `{ ok, reason }`. */
  LAUNCH_RESULT: 'launch_result',
  /** The player left the game. */
  RETURN_TO_ROOM: 'return_to_room',
  /** The game wants the full-screen layout. */
  REQUEST_FULLSCREEN: 'request_fullscreen',
} as const;

/** Message types we send down. */
export const FLY_GAME_MESSAGE_OUT = {
  LAUNCH: 'launch',
  /** Sent after `launch`, only when the game was opened from a Room. */
  ROOM: 'room',
} as const;

/**
 * Least time between two token mints for one open game, in ms.
 *
 * `POST /games/fly/token` shares `throttle:20,1` with `/games`, `/games/launch` and
 * `/games/close`. A healthy game sends `ready` once on load and once an hour on
 * session expiry, so 5 s never delays a real login — a `ready` inside the window is
 * answered when it ends, not dropped — while a frame stuck in a `ready` loop costs
 * at most 12 mints a minute.
 */
export const FLY_GAME_MIN_MINT_INTERVAL_MS = 5_000;

/** Shown when the game answers `launch_result ok:false`. */
export const FLY_GAME_LOGIN_FAILED_MESSAGE = 'The game could not sign you in.';

/** Shown when a Fly catalogue row has no usable origin (never expected from our server). */
export const FLY_GAME_UNAVAILABLE_MESSAGE = 'This game is unavailable right now.';
