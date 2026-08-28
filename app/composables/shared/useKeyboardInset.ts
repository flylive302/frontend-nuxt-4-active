import { KEYBOARD_CLOSE_SETTLE_MS, KEYBOARD_OPEN_MIN_INSET_PX } from '~/constants/keyboard';

/**
 * How the on-screen keyboard's height is being measured on this device.
 * Exposed so a device probe can report which branch is live — the two branches
 * are mutually exclusive and cannot be cross-checked against each other.
 */
export type KeyboardInsetSource = 'virtual-keyboard' | 'visual-viewport' | 'none';

/** Subset of the VirtualKeyboard API (Chromium 94+) that this composable uses. */
interface VirtualKeyboard extends EventTarget {
  /** When true the browser stops resizing viewports for the keyboard. */
  overlaysContent: boolean;
  /** Keyboard geometry in CSS pixels — an all-zero rect while `overlaysContent` is false. */
  readonly boundingRect: DOMRect;
  /** Dismisses the keyboard without moving focus. Only honoured while `overlaysContent` is true. */
  hide(): void;
}

function getVirtualKeyboard(): VirtualKeyboard | null {
  if (!import.meta.client) return null;
  const nav = navigator as Navigator & { virtualKeyboard?: VirtualKeyboard };
  return nav.virtualKeyboard ?? null;
}

/**
 * Tracks how many CSS pixels at the bottom of the layout viewport the on-screen
 * keyboard currently covers, so an element can be pinned directly above it.
 *
 * Two strategies, selected by feature detection. They are MUTUALLY EXCLUSIVE —
 * never sum, max, or fall through between them:
 *
 * - **VirtualKeyboard API.** Opting into `overlaysContent` tells the browser to
 *   stop resizing *any* viewport for the keyboard, so surrounding UI never
 *   reflows and `boundingRect.height` is the authoritative overlap. That opt-in
 *   is document-wide, which is why it is bound to `active` rather than to the
 *   composable's lifetime: the room also hosts a DM composer (inbox drawer) that
 *   still wants the browser's default keyboard handling.
 * - **`visualViewport` fallback.** The overlap is whatever the layout viewport
 *   has that the visual viewport does not. This is correct in both browser
 *   modes: under `interactive-widget=resizes-visual` (the default) it is the
 *   real keyboard height, and under `resizes-content` it collapses to ~0 —
 *   which is also right, because there the layout viewport already ends above
 *   the keyboard.
 *
 * The fallback silently reads 0 whenever `overlaysContent` is on, which is
 * precisely why exactly one branch may run.
 *
 * NOTE: `visualViewport.height` is expressed in visual-viewport units, i.e.
 * divided by `visualViewport.scale`. This app pins scale via
 * `user-scalable=no, maximum-scale=1` in the viewport meta, so no divisor is
 * needed here. Do not copy this formula somewhere zoom is allowed.
 *
 * @param active - Whether the caller currently wants keyboard tracking. Gates
 *   the document-wide `overlaysContent` opt-in described above.
 */
export function useKeyboardInset(active: Ref<boolean>) {
  const inset = ref(0);
  const source = ref<KeyboardInsetSource>('none');

  const isKeyboardOpen = ref(false);
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  function clearCloseTimer(): void {
    if (closeTimer === null) return;
    clearTimeout(closeTimer);
    closeTimer = null;
  }

  // Opening is edge-triggered; closing waits out the animation. See
  // KEYBOARD_CLOSE_SETTLE_MS for why the asymmetry is deliberate.
  watch(inset, (value) => {
    if (value >= KEYBOARD_OPEN_MIN_INSET_PX) {
      clearCloseTimer();
      isKeyboardOpen.value = true;
      return;
    }
    if (!isKeyboardOpen.value || closeTimer !== null) return;
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (inset.value < KEYBOARD_OPEN_MIN_INSET_PX) isKeyboardOpen.value = false;
    }, KEYBOARD_CLOSE_SETTLE_MS);
  });

  const virtualKeyboard = getVirtualKeyboard();
  /** Restored on teardown so this composable cannot leak a document-wide mode. */
  let previousOverlaysContent = false;

  /**
   * Asks the platform to put the keyboard away.
   *
   * Blurring the field is the usual lever, but under the VirtualKeyboard API
   * the page has taken ownership of keyboard geometry and some Chromium builds
   * expect this explicit call instead. Harmless where blur was enough; on the
   * `visual-viewport` branch there is nothing to call and blur is the only
   * lever, so this is a no-op there.
   */
  function hide(): void {
    virtualKeyboard?.hide();
  }

  function readVirtualKeyboard(): void {
    if (!virtualKeyboard) return;
    inset.value = Math.max(0, Math.round(virtualKeyboard.boundingRect.height));
  }

  function readVisualViewport(): void {
    const viewport = window.visualViewport;
    if (!viewport) return;
    // What the layout viewport has that the visual viewport does not.
    const covered = window.innerHeight - (viewport.height + viewport.offsetTop);
    inset.value = Math.max(0, Math.round(covered));
  }

  function attach(): void {
    if (!import.meta.client) return;

    if (virtualKeyboard) {
      source.value = 'virtual-keyboard';
      previousOverlaysContent = virtualKeyboard.overlaysContent;
      virtualKeyboard.addEventListener('geometrychange', readVirtualKeyboard);
      return;
    }

    if (window.visualViewport) {
      source.value = 'visual-viewport';
      window.visualViewport.addEventListener('resize', readVisualViewport);
      window.visualViewport.addEventListener('scroll', readVisualViewport);
    }
  }

  function detach(): void {
    if (!import.meta.client) return;
    clearCloseTimer();

    if (virtualKeyboard) {
      virtualKeyboard.removeEventListener('geometrychange', readVirtualKeyboard);
      virtualKeyboard.overlaysContent = previousOverlaysContent;
      return;
    }

    window.visualViewport?.removeEventListener('resize', readVisualViewport);
    window.visualViewport?.removeEventListener('scroll', readVisualViewport);
  }

  watch(active, (isActive) => {
    if (!virtualKeyboard) return;
    virtualKeyboard.overlaysContent = isActive;
    // Leaving overlay mode zeroes `boundingRect`; re-read so a stale inset from
    // the previous session cannot keep the caller pinned to a closed keyboard.
    readVirtualKeyboard();
  });

  onMounted(attach);
  onBeforeUnmount(detach);

  return {
    /** Pixels of the layout viewport covered by the keyboard right now. */
    inset: readonly(inset),
    /** True once the overlap is too tall to be anything but a keyboard. */
    isKeyboardOpen: readonly(isKeyboardOpen),
    /** Which measurement strategy this device selected. */
    source: readonly(source),
    /** Explicitly dismiss the keyboard. Call BEFORE dropping `active`. */
    hide,
  };
}
