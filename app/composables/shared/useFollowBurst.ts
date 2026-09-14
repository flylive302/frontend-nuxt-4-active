import { ref } from 'vue'

/** Duration of the burst/bounce animation in ms — keep in sync with main.css. */
const FOLLOW_BURST_DURATION_MS = 600

/**
 * Reusable follow-button celebration animation.
 *
 * REACT-only: owns no follow state and performs no network work. Callers run
 * their own follow flow, then call `burst()` when the result was a *new*
 * follow (never on unfollow).
 *
 * Bind the returned flag to the `follow-btn--animating` class alongside the
 * base `follow-btn` class (both defined globally in `assets/css/main.css`).
 */
export function useFollowBurst() {
  const followAnimating = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let raf = 0

  function burst(): void {
    // Re-triggering mid-animation must restart it, not stack timers.
    if (timer) clearTimeout(timer)
    if (raf) cancelAnimationFrame(raf)
    followAnimating.value = false
    // Next frame, so the removed class actually re-applies.
    raf = requestAnimationFrame(() => {
      raf = 0
      followAnimating.value = true
      timer = setTimeout(() => {
        followAnimating.value = false
        timer = null
      }, FOLLOW_BURST_DURATION_MS)
    })
  }

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
    // A tap followed by back-navigation before the next frame would otherwise
    // let the rAF fire after dispose and arm a timer nobody clears.
    if (raf) cancelAnimationFrame(raf)
  })

  return { followAnimating, burst }
}
