/**
 * JoyPlay third-party games — static values.
 *
 * Design: docs/reference/joyplay/joyplay-integration-design.md
 * postMessage contract: docs/reference/joyplay/vendor-doc/joyplay-iframe-integration-CN.txt
 */
import type { GameLayout } from '~/types/room/games';

/**
 * Messages the GAME sends up to us.
 *
 * They are bare strings, not objects — `parent.postMessage("recharge", "*")`. We
 * have asked JoyPlay for structured JSON payloads (vendor question C3) and they
 * invite change requests, but until that lands, string equality is the contract.
 */
export const GAME_MESSAGE_IN = {
  /** Player tapped the balance area or the `+`. Open our recharge. */
  CLICK_RECHARGE: 'clickRecharge',
  /** Player tried to stake more than they hold. Open our recharge. */
  RECHARGE: 'recharge',
  /** The game finished booting. */
  OPEN_GAME_SUCCESS: 'OpenGameSucc',
  /** Player tapped the in-game exit button. */
  CLOSE: 'newTppClose',
} as const;

/**
 * Messages WE send down to the game.
 *
 * ⚠️ `recharge` appears on BOTH sides of the bridge with OPPOSITE meanings:
 * inbound it means "the player wants to top up", outbound it means "their balance
 * changed, re-read it from our API". Sending it in response to receiving it would
 * be an infinite loop, so the two are deliberately kept in separate maps.
 */
export const GAME_MESSAGE_OUT = {
  /** Tells the game to re-fetch the balance via `getUserInfo`. */
  BALANCE_CHANGED: 'recharge',
} as const;

/*
 * ⛔ `GAME_LOAD_TIMEOUT_MS` was removed on 2026-08-04 along with the load-failure
 * timeout it fed. Do not reintroduce either.
 *
 * No duration works. The signals that would clear it are both unusable —
 * `OpenGameSucc` is logged inside their build and never posted to us, and an
 * iframe `load` waits for a whole Cocos bundle, which had still not fired 20
 * seconds after the player was already spinning. The timeout therefore fired on
 * healthy sessions and covered a working game with "The game did not load".
 *
 * A game that genuinely fails renders its own error with a Reboot button, which is
 * more specific than anything we could show. See `useRoomGames.ts`.
 */

/** Local storage / analytics label for the panel. */
export const GAME_PANEL_TITLE = 'Games';

/**
 * Minimum WEALTH level required to see and open the games panel.
 *
 * Wealth level 0 is "below the first level definition" on both sides of the wire
 * (`computeLevelStatus` in `app/utils/levels.ts` and `LevelService::getLevelStatusForType`
 * both return 0, not 1), so this threshold means "reached level 2", not "reached the
 * second tier of a 1-indexed scale". Do not change one without the other.
 *
 * ⚠️ Client-side only. `/games/launch` gates on the JoyPlay kill switch alone — a
 * level-0 user calling the endpoint directly is still served a session.
 */
export const MIN_WEALTH_LEVEL_FOR_GAMES = 2;

/**
 * Where a catalogue game's icon lives: `public/images/games/<game_id>.webp`.
 *
 * Bundled local files, NOT catalog pictures — they never go through
 * `~/utils/imagekit`. The operator adds them over time, so a missing file is the
 * normal case and the picker falls back to a text tile (see `gameIconUrl`).
 */
export const GAME_ICON_BASE_PATH = '/images/games';
export const GAME_ICON_EXTENSION = 'webp';

/** Placeholder tiles shown while the catalogue loads — two rows of three. */
export const GAME_PICKER_SKELETON_COUNT = 6;

/**
 * The most of the viewport height a bottom-sheet game may use, in `dvh`.
 *
 * The sheet panel is sized by WIDTH (`w-full`) and its height follows from the
 * aspect ratio. On a phone that is fine. On a wide, short screen (landscape, a
 * tablet browser) full width makes the panel taller than the screen, so the width
 * is capped such that the HEIGHT never exceeds this share. The stock drawer allows
 * `max-h-[96%]`; the remaining ~11% is the handle and the bottom safe-area inset.
 */
export const GAME_SHEET_MAX_HEIGHT_DVH = 85;

/**
 * Panel classes for the two sheet layouts. `full` has no entry — it is not a sheet.
 *
 * ⚠️ LITERAL strings on purpose. Tailwind extracts classes from source text only,
 * so building `max-w-[${n}dvh]` at runtime would emit nothing. The numbers below
 * are `GAME_SHEET_MAX_HEIGHT_DVH` written out; a test pins them together.
 *
 *   half  1:1  height = width       → cap width at 85dvh
 *   tall  2:3  height = 1.5 × width → cap width at 85dvh × 2/3
 *
 * `mx-auto` centres the capped panel inside the drawer's flex column.
 */
export const GAME_SHEET_PANEL_CLASS: Record<Exclude<GameLayout, 'full'>, string> = {
  half: 'mx-auto w-full max-w-[85dvh] aspect-square',
  tall: 'mx-auto w-full max-w-[calc(85dvh*2/3)] aspect-[2/3]',
};
