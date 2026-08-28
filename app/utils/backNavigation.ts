/**
 * Pure decision layer for the Android hardware back button.
 *
 * Deliberately free of DOM, router, Capacitor and Pinia so the whole priority
 * ladder is unit-testable under vitest's `node` environment. Everything that
 * touches the outside world lives in `useAndroidBackButton`.
 */

import { BACK_PRESS_COOLDOWN_MS, EXIT_CONFIRM_WINDOW_MS, EXIT_ROUTES } from '~/constants/navigation';

/** What a single back press should do. Exactly one of these, never a combination. */
export type BackAction =
  /** Swallow the press — it landed inside the post-press cooldown. */
  | 'ignore'
  /** Close the top entry of the explicit registry (non-Reka or non-dismissible overlays). */
  | 'dismiss-registered'
  /** Close the top Reka dialog layer by dispatching Escape. */
  | 'dismiss-dialog'
  /** Ordinary history back. */
  | 'navigate-back'
  /** No history behind us and we are not on an exit route — go home rather than quit. */
  | 'navigate-home'
  /** First press on an exit route: arm the confirmation and tell the user. */
  | 'prompt-exit'
  /** Second press on an exit route, inside the window: quit. */
  | 'exit-app';

export interface BackContext {
  /** `Date.now()` at the moment the press arrived. */
  readonly now: number;
  /** When the last non-ignored press was handled, or `null` if this is the first. */
  readonly lastHandledAt: number | null;
  /** Whether the explicit registry holds at least one open overlay. */
  readonly hasRegisteredOverlay: boolean;
  /** Whether at least one Reka dialog layer is open in the DOM. */
  readonly hasDialogLayer: boolean;
  /** Whether the WebView has history to go back to. */
  readonly canGoBack: boolean;
  /** Current route path, compared against `EXIT_ROUTES`. */
  readonly routePath: string;
  /** When `prompt-exit` last fired, or `null` if the prompt is not armed. */
  readonly exitPromptedAt: number | null;
}

/** True when back on this route means "leave the app" instead of "go back". */
export function isExitRoute(routePath: string): boolean {
  return EXIT_ROUTES.includes(routePath);
}

/**
 * Resolves one back press to one action.
 *
 * The ladder is strictly ordered, and the order is the feature:
 *
 * 1. **Cooldown** — see `BACK_PRESS_COOLDOWN_MS`.
 * 2. **Registered overlays** before dialog layers. Everything in the registry is
 *    either not a Reka layer at all (raw `Teleport` viewers) or a Reka layer
 *    that refuses Escape, and in practice both open *on top of* whatever dialog
 *    is beneath them. Checking the registry first is what keeps the close order
 *    last-in-first-out across the two mechanisms.
 * 3. **Dialog layers** — Reka's own stack already resolves "topmost" for us.
 * 4. **Exit route** before history. On the home tab back quits, even when there
 *    is history behind it; that is the platform convention, and the two-press
 *    confirmation is what makes it safe.
 * 5. **History**, then home as the floor. A screen opened cold (deep link, push
 *    notification) has no history — going home beats quitting.
 */
export function resolveBackAction(ctx: BackContext): BackAction {
  // GATE — a press inside the cooldown is a press we would mishandle.
  if (ctx.lastHandledAt !== null && ctx.now - ctx.lastHandledAt < BACK_PRESS_COOLDOWN_MS) {
    return 'ignore';
  }

  if (ctx.hasRegisteredOverlay) return 'dismiss-registered';
  if (ctx.hasDialogLayer) return 'dismiss-dialog';

  if (isExitRoute(ctx.routePath)) {
    const armed =
      ctx.exitPromptedAt !== null && ctx.now - ctx.exitPromptedAt < EXIT_CONFIRM_WINDOW_MS;
    return armed ? 'exit-app' : 'prompt-exit';
  }

  return ctx.canGoBack ? 'navigate-back' : 'navigate-home';
}
