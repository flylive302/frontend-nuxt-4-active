/**
 * Android hardware back-button constants.
 *
 * Kept separate from `room.ts` / `keyboard.ts` because the back button is an
 * app-wide concern — the room is its busiest consumer, not its only one.
 */

/**
 * Matches every OPEN dialog-family overlay in the DOM: `UModal`, `UDrawer`,
 * `USlideover`.
 *
 * All three resolve to Reka UI's `DialogContentImpl`, which renders
 * `role="dialog"` + `aria-describedby` + `data-state` onto the same element
 * that `DismissableLayer` tags with `data-dismissable-layer`.
 *
 * ⚠️ `aria-describedby` is doing real work here, not decoration. `UPopover`
 * also renders `role="dialog"` on a dismissable layer, but its attribute list
 * is `id` / `data-state` / `aria-labelledby` only — no `aria-describedby`.
 * Dropping that clause would make the back button eat popover presses, which
 * the product decision explicitly excludes (dropdown menus are excluded for
 * free — `MenuContentImpl` renders `role="menu"`).
 *
 * `data-state="open"` excludes layers that are mid-exit-animation: Reka flips
 * the attribute to `"closed"` immediately on dismiss but keeps the element
 * mounted until the transition ends.
 */
export const DIALOG_LAYER_SELECTOR =
  '[data-dismissable-layer][role="dialog"][aria-describedby][data-state="open"]';

/**
 * How long, in milliseconds, back presses are ignored after one is handled.
 *
 * Not a debounce for human double-taps — a correctness guard. Reka only removes
 * a layer from its internal `layersRoot` set on unmount cleanup, while
 * `data-state` flips to `"closed"` synchronously. In that window a second press
 * sees the layer beneath as "the top open dialog" and dispatches Escape at it,
 * but Reka's own `isHighestLayer` check still counts the closing layer — so the
 * press is silently swallowed and the user's second tap does nothing.
 */
export const BACK_PRESS_COOLDOWN_MS = 250;

/**
 * How long, in milliseconds, the "press back again to exit" prompt stays armed.
 *
 * Long enough to read the toast and react, short enough that a stray press
 * minutes later never quits the app on its own.
 */
export const EXIT_CONFIRM_WINDOW_MS = 2000;

/**
 * Routes where back means "leave the app" rather than "go back".
 *
 * Only the home tab. Everywhere else falls through to normal history
 * navigation, and a screen reached with no history behind it goes home instead
 * of exiting — quitting the app from a deep link would be a surprise.
 */
export const EXIT_ROUTES: readonly string[] = ['/'];

/** Copy for the first of the two presses that exit the app. */
export const EXIT_PROMPT_TOAST = {
  title: 'Press back again to exit',
  duration: EXIT_CONFIRM_WINDOW_MS,
} as const;
