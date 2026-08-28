import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import {
  __resetBackDismissRegistry,
  dismissTopRegisteredOverlay,
  hasRegisteredOverlay,
  useBackDismiss,
} from '~/composables/shared/useBackDismiss';

/**
 * `useBackDismiss` calls `onScopeDispose`, which warns (and no-ops) outside an
 * effect scope. Every test runs inside one so unmount can be simulated.
 */
function inScope<T>(fn: () => T): { result: T; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(fn) as T;
  return { result, stop: () => scope.stop() };
}

beforeEach(() => {
  __resetBackDismissRegistry();
});

describe('useBackDismiss', () => {
  it('registers nothing while the overlay is closed', () => {
    const isOpen = ref(false);
    inScope(() => useBackDismiss(isOpen, vi.fn()));

    expect(hasRegisteredOverlay()).toBe(false);
    expect(dismissTopRegisteredOverlay()).toBe(false);
  });

  it('registers an overlay that is already open on mount', () => {
    const isOpen = ref(true);
    inScope(() => useBackDismiss(isOpen, vi.fn()));

    expect(hasRegisteredOverlay()).toBe(true);
  });

  it('registers and unregisters as the overlay opens and closes', async () => {
    const isOpen = ref(false);
    inScope(() => useBackDismiss(isOpen, vi.fn()));

    isOpen.value = true;
    await nextTick();
    expect(hasRegisteredOverlay()).toBe(true);

    isOpen.value = false;
    await nextTick();
    expect(hasRegisteredOverlay()).toBe(false);
  });

  it('accepts a getter as well as a ref', async () => {
    const isOpen = ref(false);
    inScope(() => useBackDismiss(() => isOpen.value, vi.fn()));

    isOpen.value = true;
    await nextTick();
    expect(hasRegisteredOverlay()).toBe(true);
  });

  it('closes the most recently opened overlay first', async () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const first = ref(true);
    const second = ref(false);

    inScope(() => useBackDismiss(first, closeFirst));
    inScope(() => useBackDismiss(second, closeSecond));

    second.value = true;
    await nextTick();

    expect(dismissTopRegisteredOverlay()).toBe(true);
    expect(closeSecond).toHaveBeenCalledOnce();
    expect(closeFirst).not.toHaveBeenCalled();
  });

  it('falls through to the one beneath once the top one closes', async () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const first = ref(true);
    const second = ref(true);

    inScope(() => useBackDismiss(first, closeFirst));
    inScope(() => useBackDismiss(second, closeSecond));

    second.value = false;
    await nextTick();

    dismissTopRegisteredOverlay();
    expect(closeFirst).toHaveBeenCalledOnce();
    expect(closeSecond).not.toHaveBeenCalled();
  });

  it('moves a re-opened overlay back to the top of the stack', async () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const first = ref(true);
    const second = ref(true);

    inScope(() => useBackDismiss(first, closeFirst));
    inScope(() => useBackDismiss(second, closeSecond));

    // `first` re-opens on top of `second`, so it must now take the press.
    first.value = false;
    await nextTick();
    first.value = true;
    await nextTick();

    dismissTopRegisteredOverlay();
    expect(closeFirst).toHaveBeenCalledOnce();
    expect(closeSecond).not.toHaveBeenCalled();
  });

  it('keeps the entry when the close handler declines to close', () => {
    const isOpen = ref(true);
    const stubbornClose = vi.fn(); // never flips `isOpen`
    inScope(() => useBackDismiss(isOpen, stubbornClose));

    expect(dismissTopRegisteredOverlay()).toBe(true);
    expect(dismissTopRegisteredOverlay()).toBe(true);
    expect(stubbornClose).toHaveBeenCalledTimes(2);
    expect(hasRegisteredOverlay()).toBe(true);
  });

  it('unregisters when the owning component is unmounted while open', () => {
    const isOpen = ref(true);
    const { stop } = inScope(() => useBackDismiss(isOpen, vi.fn()));

    expect(hasRegisteredOverlay()).toBe(true);
    stop();
    expect(hasRegisteredOverlay()).toBe(false);
  });
});
