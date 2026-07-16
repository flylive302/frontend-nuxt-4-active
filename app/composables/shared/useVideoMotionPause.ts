/**
 * useVideoMotionPause
 *
 * Pauses a decorative, looping `<video>` while the user can't appreciate it:
 * while actively scrolling (resumes after a short idle timeout), and while a
 * modal/drawer covers the page (caller-supplied `covered` getter). Visual
 * appearance is unchanged while idle and visible — this only toggles
 * play/pause, never removes or hides the element.
 *
 * Product decision (capacitor-performance issue 08): PAUSE, never remove.
 */
import { toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { VIDEO_MOTION_SCROLL_IDLE_MS } from '~/constants/mall'

/**
 * @param videoRef Template ref to the decorative `<video>` element.
 * @param covered Optional getter/ref — true while a modal/drawer covers the page.
 */
export function useVideoMotionPause(
  videoRef: Ref<HTMLVideoElement | null | undefined>,
  covered: MaybeRefOrGetter<boolean> = false,
): void {
  let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null
  let isScrolling = false

  function clearScrollIdleTimer(): void {
    if (scrollIdleTimer !== null) {
      clearTimeout(scrollIdleTimer)
      scrollIdleTimer = null
    }
  }

  function applyMotionState(): void {
    const video = videoRef.value
    if (!video) return

    const shouldPause = isScrolling || toValue(covered)
    if (shouldPause) {
      if (!video.paused) video.pause()
    } else if (video.paused) {
      void video.play().catch(() => {
        // Autoplay can be rejected by the browser (e.g. no user gesture yet);
        // the video simply stays paused until the next resume trigger.
      })
    }
  }

  function handleScroll(): void {
    isScrolling = true
    applyMotionState()

    clearScrollIdleTimer()
    scrollIdleTimer = setTimeout(() => {
      isScrolling = false
      applyMotionState()
    }, VIDEO_MOTION_SCROLL_IDLE_MS)
  }

  // No explicit target: vueuse defaults to `window`, resolved lazily via its
  // SSR-safe `defaultWindow` (no bare `window` reference at call time — safe
  // under both SSR and the Vitest `node` test environment).
  useEventListener('scroll', handleScroll, { passive: true, capture: true })

  watch(
    () => toValue(covered),
    () => applyMotionState(),
  )

  watch(videoRef, () => applyMotionState(), { immediate: true })
}
