/**
 * useDeferredVisibility
 *
 * Tracks whether a target element is on-screen, gated by an `enabled` flag.
 * When disabled, visibility is always `true` (no observer attached, no
 * behavior change for callers that don't opt in to deferring).
 * When enabled, visibility tracks the IntersectionObserver's `isIntersecting`
 * flag directly — true on enter, false on exit — so callers can pause/resume
 * expensive work (canvas loops, decode) exactly while off-screen.
 *
 * Extracted from `UserAvatar`'s SVGA-frame defer logic (capacitor-performance
 * issue 02) so the visibility mapping is unit-testable without mounting a
 * component (this repo's Vitest environment is plain `node`, no DOM).
 */
import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { DEFERRED_VISIBILITY_ROOT_MARGIN, DEFERRED_VISIBILITY_THRESHOLD } from '~/constants/assets'

export interface UseDeferredVisibility {
  /** True when the target should be considered "visible" (or deferring is disabled). */
  isVisible: Ref<boolean>
}

/**
 * @param target Element to observe (a template ref).
 * @param enabled Whether deferred visibility tracking is active for this instance.
 */
export function useDeferredVisibility(
  target: Ref<HTMLElement | null | undefined>,
  enabled: MaybeRefOrGetter<boolean>,
): UseDeferredVisibility {
  const isEnabled = computed(() => toValue(enabled))
  const isVisible = ref(!isEnabled.value)

  // If `enabled` flips false at runtime, fall back to always-visible immediately
  // rather than waiting on the next observer callback.
  watch(isEnabled, (value) => {
    if (!value) isVisible.value = true
  })

  useIntersectionObserver(
    target,
    ([entry]) => {
      if (!isEnabled.value || !entry) return
      isVisible.value = entry.isIntersecting
    },
    { rootMargin: DEFERRED_VISIBILITY_ROOT_MARGIN, threshold: DEFERRED_VISIBILITY_THRESHOLD },
  )

  return { isVisible }
}
