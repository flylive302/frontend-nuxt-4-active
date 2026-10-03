/**
 * useSharedResize
 *
 * Run `onResize` (next animation frame, batched app-wide) whenever any of the
 * target elements changes size, via the shared ResizeObserver
 * (`services/sharedObservers`). Targets must be block-level — inline elements
 * never report a size.
 */
import { onScopeDispose, watch, type Ref } from 'vue'
import { observeResize } from '~/services/sharedObservers'

export function useSharedResize(
  targets: ReadonlyArray<Readonly<Ref<HTMLElement | null>>>,
  onResize: () => void,
): void {
  let stops: Array<() => void> = []

  function release(): void {
    for (const stop of stops) stop()
    stops = []
  }

  watch(
    targets,
    (els) => {
      release()
      stops = els.filter((el): el is HTMLElement => !!el).map(el => observeResize(el, onResize))
    },
    { immediate: true },
  )

  onScopeDispose(release)
}
