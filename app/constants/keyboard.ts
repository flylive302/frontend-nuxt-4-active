/**
 * On-screen (soft) keyboard constants.
 *
 * Kept out of `room.ts` because `useKeyboardInset` is a shared composable — the
 * room chat composer is its first consumer, not its only possible one.
 */

/**
 * Minimum viewport overlap, in CSS pixels, before the on-screen keyboard is
 * treated as open.
 *
 * The visual viewport also moves by a few pixels for things that are not the
 * keyboard (URL-bar collapse in a browser tab, an inset animation settling), so
 * a bare `inset > 0` check would flap. No soft keyboard is anywhere near this
 * short, and no non-keyboard jitter is anywhere near this tall.
 */
export const KEYBOARD_OPEN_MIN_INSET_PX = 120;

/**
 * How long, in milliseconds, the viewport overlap must stay below
 * `KEYBOARD_OPEN_MIN_INSET_PX` before the keyboard is reported closed.
 *
 * Opening is edge-triggered and instant; closing is not. The overlap is
 * animated, and `visualViewport` emits during that animation, so a rising
 * keyboard can momentarily read short. Without this delay a consumer that
 * closes itself on `isKeyboardOpen === false` would tear itself down halfway
 * through the keyboard opening.
 */
export const KEYBOARD_CLOSE_SETTLE_MS = 250;
