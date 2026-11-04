/**
 * JoyPlay games — pure layout and URL decisions.
 *
 * No Vue, no stores: the composable and the components both read these, and the
 * tests exercise them directly.
 */
import {
  GAME_ICON_BASE_PATH,
  GAME_ICON_EXTENSION,
  GAME_SHEET_PANEL_CLASS,
} from '~/constants/games';
import type { GameContainer, GameLayout } from '~/types/room/games';

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
 * URL of a game's icon in `public/`. The file may not exist yet — the caller
 * shows a text tile until the image actually loads.
 */
export function gameIconUrl(gameId: string): string {
  return `${GAME_ICON_BASE_PATH}/${encodeURIComponent(gameId)}.${GAME_ICON_EXTENSION}`;
}
