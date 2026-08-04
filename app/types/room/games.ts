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
