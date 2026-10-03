/**
 * useInViewport
 *
 * Whether a target element is currently on screen, via the app-wide shared
 * IntersectionObserver (`services/sharedObservers`). Use this for surfaces
 * that render by the dozen (names in seats, chat, lists); for one-off
 * surfaces that need a root margin, `useDeferredVisibility` still fits.
 *
 * `false` until the observer's first report, and whenever observation is
 * disabled — so anything gated on it stays off rather than flashing on.
 */
import { onScopeDispose, readonly, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { observeVisibility } from '~/services/sharedObservers'

/**
 * @param target Element to observe (a template ref).
 * @param enabled Observe only while true — e.g. only names that have a glint.
 */
export function useInViewport(
  target: Readonly<Ref<HTMLElement | null>>,
  enabled: MaybeRefOrGetter<boolean> = true,
): Readonly<Ref<boolean>> {
  const inView = ref(false)
  let stop: (() => void) | null = null

  function release(): void {
    stop?.()
    stop = null
  }

  watch(
    [target, () => toValue(enabled)],
    ([el, on]) => {
      release()
      inView.value = false
      if (el && on) stop = observeVisibility(el, (visible) => { inView.value = visible })
    },
    { immediate: true },
  )

  onScopeDispose(release)

  return readonly(inView)
}
