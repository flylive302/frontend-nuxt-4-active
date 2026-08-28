import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue';

/**
 * Opt-in registry for overlays the Android back button cannot close on its own.
 *
 * The back handler closes a normal `UModal` / `UDrawer` / `USlideover` by
 * dispatching Escape and letting Reka UI's `DismissableLayer` pick the topmost
 * layer. Two kinds of overlay are invisible to that mechanism and must register
 * here instead:
 *
 * - **Not a Reka layer at all** — a raw `<Teleport>` + `v-if` viewer. Escape
 *   reaches no listener, so without a registration the back button would sail
 *   straight past it and navigate away with the overlay still on screen.
 * - **A Reka layer that refuses Escape** — `:dismissible="false"` /
 *   `:prevent-close="true"`. Escape is swallowed by design, so back would be
 *   consumed and yet close nothing, stranding the user.
 *
 * Registering also lets a component route back to the *right* close path rather
 * than a generic one — the mission finale must go through `dismiss()` so the
 * "seen it" flag reaches localStorage, and a permission dialog must go through
 * cancel so the caller learns the answer.
 */

interface BackDismissEntry {
  readonly id: number;
  readonly close: () => void;
}

/**
 * Open overlays, oldest first — the last entry is the topmost.
 *
 * Module scope, not a store: this is ephemeral view state with exactly one
 * reader, and the SPA gives it a single instance for the app's lifetime.
 */
const stack: BackDismissEntry[] = [];
let nextId = 1;

/** Whether any registered overlay is currently open. */
export function hasRegisteredOverlay(): boolean {
  return stack.length > 0;
}

/**
 * Runs the close handler of the topmost registered overlay.
 *
 * Does NOT pop the entry. The entry removes itself when its own `isOpen` flips
 * false, which keeps the registry honest: if a close handler declines to close
 * (a guard, a confirmation), the entry stays and the next press retries it
 * rather than falling through to navigation.
 *
 * @returns whether an entry was found to close.
 */
export function dismissTopRegisteredOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

/** Test seam — drops every registration. Not for application code. */
export function __resetBackDismissRegistry(): void {
  stack.length = 0;
}

/**
 * Registers an overlay so the Android back button closes it before navigating.
 *
 * Call once from the component that OWNS the overlay's open state.
 *
 * @param isOpen - the overlay's open flag; drives registration both ways.
 * @param close - how to close it. Must be the component's real close path, not
 *                a bare `isOpen.value = false`, whenever closing has side
 *                effects (persistence, an emit the parent depends on).
 */
export function useBackDismiss(isOpen: MaybeRefOrGetter<boolean>, close: () => void): void {
  const id = nextId++;

  function remove(): void {
    const index = stack.findIndex((entry) => entry.id === id);
    if (index !== -1) stack.splice(index, 1);
  }

  watch(
    () => toValue(isOpen),
    (open) => {
      // Remove-then-push, never push-only: re-opening an overlay must move it
      // back to the top of the stack, or a later-opened sibling would keep
      // stealing the next back press.
      remove();
      if (open) stack.push({ id, close });
    },
    { immediate: true },
  );

  onScopeDispose(remove);
}
