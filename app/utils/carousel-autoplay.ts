/**
 * Pure decision for in-view autoplay pausing (home-page-runtime-audit/1).
 *
 * Rule (approved 2026-09-12, "1A"): leaving the viewport pauses whatever was
 * playing; re-entering resumes only what the pause itself stopped. A carousel
 * the user stopped by swiping (`stopOnInteraction`) stays stopped — scrolling
 * away and back never re-arms it.
 */
export type AutoplayAction = 'play' | 'stop' | 'none'

export interface AutoplayDecision {
  action: AutoplayAction
  /** Carry into the next call: was autoplay running when we paused it? */
  resumeOnEnter: boolean
}

/**
 * @param visible       is the carousel in the viewport now
 * @param isPlaying     the plugin's `isPlaying()` at this moment
 * @param resumeOnEnter the value returned by the previous call
 */
export function nextAutoplayAction(
  visible: boolean,
  isPlaying: boolean,
  resumeOnEnter: boolean
): AutoplayDecision {
  if (!visible) {
    // Remember whether *we* are the reason it is stopped.
    return { action: isPlaying ? 'stop' : 'none', resumeOnEnter: isPlaying || resumeOnEnter }
  }
  if (resumeOnEnter && !isPlaying) return { action: 'play', resumeOnEnter: false }
  return { action: 'none', resumeOnEnter: false }
}
