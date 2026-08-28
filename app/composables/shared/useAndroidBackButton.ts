import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  DIALOG_LAYER_SELECTOR,
  EXIT_PROMPT_TOAST,
  EXIT_ROUTES,
} from '~/constants/navigation';
import { resolveBackAction, type BackAction } from '~/utils/backNavigation';
import { dismissTopRegisteredOverlay, hasRegisteredOverlay } from './useBackDismiss';
import { createLogger } from '~/utils/logger';

const log = createLogger('[AndroidBack]');

/**
 * Makes the Android hardware back button close the topmost open overlay before
 * it navigates anywhere.
 *
 * ⚠️ Registering a `backButton` listener DISABLES Capacitor's own default
 * handling — the plugin's `OnBackPressedCallback` checks `hasListeners()` and
 * skips its `webView.goBack()` fallback entirely once we are listening. Every
 * outcome, including ordinary back and quitting the app, is therefore ours to
 * perform explicitly. There is no "let the default happen" branch to fall into.
 *
 * Native only. `@capacitor/app` emits nothing in a browser, and the pushState
 * trick that would emulate this on mobile web would desync
 * `nav-direction.client.ts`, which reads `history.state.position` on every
 * navigation to pick the page-transition direction.
 *
 * INTENT lives in `plugins/back-button.client.ts`; GATE is `resolveBackAction`;
 * this file is EXECUTE + REACT.
 */
export function useAndroidBackButton() {
  const router = useRouter();
  const route = useRoute();

  /** Cooldown anchor — see `BACK_PRESS_COOLDOWN_MS`. */
  let lastHandledAt: number | null = null;
  /** When the exit confirmation was armed, or `null` while it is disarmed. */
  let exitPromptedAt: number | null = null;

  let listener: PluginListenerHandle | null = null;

  // ── Probes ────────────────────────────────────────────

  function hasDialogLayer(): boolean {
    return document.querySelector(DIALOG_LAYER_SELECTOR) !== null;
  }

  // ── EXECUTE ───────────────────────────────────────────

  /**
   * Closes the topmost Reka dialog layer.
   *
   * Reka's `DismissableLayer` binds Escape through VueUse `onKeyStroke` with no
   * target option, which defaults to `window`, and its handler no-ops unless
   * the receiving layer is the highest in `layersRoot`. So one dispatched
   * Escape closes exactly one dialog — the top one — for free.
   *
   * ⚠️ Dispatched on `document` with `bubbles: true` on purpose: a window-only
   * dispatch would miss any document-level listener, while this reaches both on
   * the way up. `bubbles` defaults to FALSE on a hand-built `KeyboardEvent`, so
   * omitting it would make this call a silent no-op.
   */
  function dismissTopDialog(): void {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  function execute(action: BackAction, now: number): void {
    switch (action) {
      case 'ignore':
        return;

      case 'dismiss-registered':
        dismissTopRegisteredOverlay();
        return;

      case 'dismiss-dialog':
        dismissTopDialog();
        return;

      case 'prompt-exit':
        exitPromptedAt = now;
        // REACT — the toast is feedback, never a precondition for the exit.
        useToast().add({ ...EXIT_PROMPT_TOAST, color: 'neutral' });
        return;

      case 'exit-app':
        exitPromptedAt = null;
        log.info('Exiting on the second back press');
        void CapacitorApp.exitApp();
        return;

      case 'navigate-back':
        // Leaving a room this way is intentional: `room-minimize.global.ts`
        // picks the navigation up and minimizes into the mini-player.
        router.back();
        return;

      case 'navigate-home':
        void navigateTo(EXIT_ROUTES[0] ?? '/');
        return;
    }
  }

  // ── INTENT handler ────────────────────────────────────

  function onBackButton({ canGoBack }: { canGoBack: boolean }): void {
    const now = Date.now();

    const action = resolveBackAction({
      now,
      lastHandledAt,
      hasRegisteredOverlay: hasRegisteredOverlay(),
      hasDialogLayer: hasDialogLayer(),
      canGoBack,
      routePath: route.path,
      exitPromptedAt,
    });

    if (action === 'ignore') return;
    lastHandledAt = now;

    // Any press that was not the exit confirmation disarms it, so the prompt
    // can never be satisfied by an unrelated press later in the window.
    if (action !== 'prompt-exit' && action !== 'exit-app') exitPromptedAt = null;

    log.debug('Back press resolved', { action, path: route.path, canGoBack });
    execute(action, now);
  }

  /**
   * Starts listening. Returns a teardown; the plugin never calls it (the
   * handler is app-scoped and Nuxt has no runtime "app unmounted" hook), but
   * the unit tests drive it directly.
   */
  async function start(): Promise<() => void> {
    listener = await CapacitorApp.addListener('backButton', onBackButton);
    log.info('Hardware back button handler attached');

    return () => {
      void listener?.remove();
      listener = null;
    };
  }

  return { start, onBackButton };
}
