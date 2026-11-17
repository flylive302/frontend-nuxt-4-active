/**
 * Fly Games postMessage protocol — types only, no runtime code.
 *
 * The protocol is the Fly team's own (docs/reference/fly-games/vendor-messages.md §4).
 * Field names and values may not change without telling them.
 */

import type {
  FLY_GAME_MESSAGE_OUT,
  FLY_GAME_SOURCE_IN,
  FLY_GAME_SOURCE_OUT,
} from '~/constants/fly-games';

/** What `POST /api/v1/games/fly/token` returns inside the `data` envelope. */
export interface FlyGameTokenResponse {
  token: string;
  origin: string;
}

/** A message from the game, after the GATE (right origin, right window, right `source`). */
export interface FlyGameInboundMessage {
  source: typeof FLY_GAME_SOURCE_IN;
  /** Known: `ready`, `launch_result`, `return_to_room`, `request_fullscreen`. Others are ignored. */
  type: string;
  ok?: unknown;
  reason?: unknown;
  roomId?: unknown;
  matchId?: unknown;
}

/** Host → game. */
export type FlyGameOutboundMessage =
  | { source: typeof FLY_GAME_SOURCE_OUT; type: typeof FLY_GAME_MESSAGE_OUT.LAUNCH; token: string }
  | { source: typeof FLY_GAME_SOURCE_OUT; type: typeof FLY_GAME_MESSAGE_OUT.ROOM; roomId: string };
