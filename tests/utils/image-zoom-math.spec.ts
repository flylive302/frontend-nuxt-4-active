/**
 * Unit tests for the DM lightbox's pure gesture/zoom math (dm-messenger-v2/03).
 * No DOM, no Vue — plain numbers in, plain numbers out.
 */
import { describe, it, expect } from 'vitest'
import {
  clampScale,
  clampTranslate,
  zoomAroundPoint,
  touchDistance,
  touchMidpoint,
  nextDoubleTapScale,
  shouldDismissOnSwipe,
  LIGHTBOX_MIN_SCALE,
  LIGHTBOX_MAX_SCALE,
  LIGHTBOX_DOUBLE_TAP_SCALE,
} from '~/utils/image-zoom-math'

describe('clampScale', () => {
  it('clamps below the min to the min', () => {
    expect(clampScale(0.2)).toBe(LIGHTBOX_MIN_SCALE)
  })

  it('clamps above the max to the max', () => {
    expect(clampScale(10)).toBe(LIGHTBOX_MAX_SCALE)
  })

  it('passes through values already in range', () => {
    expect(clampScale(2.5)).toBe(2.5)
  })

  it('respects custom bounds', () => {
    expect(clampScale(5, 1, 3)).toBe(3)
  })
})

describe('clampTranslate', () => {
  it('centers (returns 0) when scaled content fits inside the viewport', () => {
    expect(clampTranslate(50, 100, 400, 1)).toBe(0)
  })

  it('clamps to the max offset when dragged past the edge', () => {
    // content 200, viewport 100, scale 2 -> scaledSize 400, maxOffset (400-100)/2=150
    expect(clampTranslate(500, 200, 100, 2)).toBe(150)
    expect(clampTranslate(-500, 200, 100, 2)).toBe(-150)
  })

  it('passes through values within bounds', () => {
    expect(clampTranslate(50, 200, 100, 2)).toBe(50)
  })
})

describe('zoomAroundPoint', () => {
  it('keeps the focal point visually fixed while scaling up', () => {
    const state = { scale: 1, translateX: 0, translateY: 0 }
    const next = zoomAroundPoint(state, { x: 100, y: 50 }, 2)
    expect(next.scale).toBe(2)
    // ratio 2, translate = focal - ratio*(focal - prevTranslate) = 100 - 2*100 = -100
    expect(next.translateX).toBe(-100)
    expect(next.translateY).toBe(-50)
  })

  it('is a no-op when the clamped scale equals the current scale', () => {
    const state = { scale: 1, translateX: 5, translateY: 5 }
    const next = zoomAroundPoint(state, { x: 0, y: 0 }, 0.1) // clamps to 1 (min)
    expect(next).toBe(state)
  })

  it('clamps the target scale to the max', () => {
    const state = { scale: 1, translateX: 0, translateY: 0 }
    const next = zoomAroundPoint(state, { x: 0, y: 0 }, 99)
    expect(next.scale).toBe(LIGHTBOX_MAX_SCALE)
  })
})

describe('touchDistance / touchMidpoint', () => {
  it('computes euclidean distance between two points', () => {
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('computes the midpoint between two points', () => {
    expect(touchMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
  })
})

describe('nextDoubleTapScale', () => {
  it('zooms in from resting scale', () => {
    expect(nextDoubleTapScale(1)).toBe(LIGHTBOX_DOUBLE_TAP_SCALE)
  })

  it('resets to 1x when already zoomed', () => {
    expect(nextDoubleTapScale(2.5)).toBe(LIGHTBOX_MIN_SCALE)
    expect(nextDoubleTapScale(1.01)).toBe(LIGHTBOX_MIN_SCALE)
  })
})

describe('shouldDismissOnSwipe', () => {
  const threshold = 100

  it('dismisses on a long, mostly-vertical downward drag at rest', () => {
    expect(shouldDismissOnSwipe(10, 150, 1, threshold)).toBe(true)
  })

  it('does not dismiss when zoomed in', () => {
    expect(shouldDismissOnSwipe(10, 150, 2, threshold)).toBe(false)
  })

  it('does not dismiss below the distance threshold', () => {
    expect(shouldDismissOnSwipe(5, 50, 1, threshold)).toBe(false)
  })

  it('does not dismiss when the drag is more horizontal than vertical', () => {
    expect(shouldDismissOnSwipe(200, 150, 1, threshold)).toBe(false)
  })

  it('does not dismiss on an upward drag', () => {
    expect(shouldDismissOnSwipe(0, -150, 1, threshold)).toBe(false)
  })
})
