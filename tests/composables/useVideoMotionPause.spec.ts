/**
 * Unit tests for useVideoMotionPause (capacitor-performance issue 08).
 *
 * Covers: pause while actively scrolling, resume after the idle timeout,
 * pause while a `covered` getter is true (modal/drawer open), and resume
 * once uncovered. Mocks `@vueuse/core`'s `useEventListener` to capture the
 * scroll handler directly (mirrors useDeferredVisibility.spec.ts's
 * intersection-callback capture pattern), since the Vitest environment is
 * plain `node` with no real `window`/DOM to dispatch scroll events on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useVideoMotionPause } from '~/composables/shared/useVideoMotionPause'

// ========================================
// Mocks
// ========================================

let scrollCallback: (() => void) | null = null

vi.mock('@vueuse/core', () => ({
  useEventListener: (_event: unknown, callback: () => void) => {
    scrollCallback = callback
    return vi.fn()
  },
}))

vi.mock('~/constants/mall', () => ({
  VIDEO_MOTION_SCROLL_IDLE_MS: 400,
}))

function fireScroll() {
  scrollCallback?.()
}

function makeVideo() {
  let paused = true
  return {
    get paused() {
      return paused
    },
    pause: vi.fn(() => {
      paused = true
    }),
    play: vi.fn(() => {
      paused = false
      return Promise.resolve()
    }),
  } as unknown as HTMLVideoElement
}

describe('useVideoMotionPause', () => {
  beforeEach(() => {
    scrollCallback = null
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays on setup when visible and uncovered (baseline, not paused by default)', () => {
    const scope = effectScope()
    const video = makeVideo()
    const videoRef = ref(video)

    scope.run(() => useVideoMotionPause(videoRef, false))

    expect(video.play).toHaveBeenCalledTimes(1)
    expect(video.paused).toBe(false)
    scope.stop()
  })

  it('pauses on scroll activity and resumes after the idle timeout', () => {
    const scope = effectScope()
    const video = makeVideo()
    const videoRef = ref(video)

    scope.run(() => useVideoMotionPause(videoRef, false))
    video.pause.mockClear()
    video.play.mockClear()

    fireScroll()
    expect(video.pause).toHaveBeenCalledTimes(1)
    expect(video.paused).toBe(true)
    expect(video.play).not.toHaveBeenCalled()

    vi.advanceTimersByTime(400)
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(video.paused).toBe(false)

    scope.stop()
  })

  it('re-arms the idle timer on repeated scroll events (no premature resume)', () => {
    const scope = effectScope()
    const video = makeVideo()
    const videoRef = ref(video)

    scope.run(() => useVideoMotionPause(videoRef, false))
    video.play.mockClear()

    fireScroll()
    vi.advanceTimersByTime(300)
    fireScroll() // resets the 400ms idle window
    vi.advanceTimersByTime(300)
    expect(video.play).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(video.play).toHaveBeenCalledTimes(1)

    scope.stop()
  })

  it('pauses while covered getter is true, resumes when uncovered', async () => {
    const scope = effectScope()
    const video = makeVideo()
    const videoRef = ref(video)
    const covered = ref(false)

    scope.run(() => useVideoMotionPause(videoRef, covered))
    expect(video.paused).toBe(false) // initial mount: visible, uncovered -> playing

    covered.value = true
    await nextTick()
    expect(video.pause).toHaveBeenCalled()
    expect(video.paused).toBe(true)

    covered.value = false
    await nextTick()
    expect(video.play).toHaveBeenCalled()
    expect(video.paused).toBe(false)

    scope.stop()
  })

  it('covered takes precedence over an idle (non-scrolling) state', async () => {
    const scope = effectScope()
    const video = makeVideo()
    const videoRef = ref(video)
    const covered = ref(false)

    scope.run(() => useVideoMotionPause(videoRef, covered))

    fireScroll()
    vi.advanceTimersByTime(400)
    expect(video.paused).toBe(false) // idle, uncovered -> playing

    covered.value = true
    await nextTick()
    expect(video.paused).toBe(true)

    scope.stop()
  })
})
