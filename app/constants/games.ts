/**
 * JoyPlay third-party games — static values.
 *
 * Design: docs/issues/game-integration/03-joyplay-integration-design.md
 * postMessage contract: docs/issues/game-integration/vendor-doc/joyplay-iframe-integration-CN.txt
 */

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
