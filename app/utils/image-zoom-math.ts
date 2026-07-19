/**
 * Image Zoom Math (dm-messenger-v2/03)
 *
 * Pure, UI-agnostic arithmetic for the DM lightbox's pinch-zoom / double-tap
 * zoom / pan gestures. No DOM, no Vue — every function takes plain numbers
 * and returns plain numbers so it's trivially unit-testable and reusable
 * from any gesture-handling composable.
 */

export const LIGHTBOX_MIN_SCALE = 1
export const LIGHTBOX_MAX_SCALE = 4
/** Scale a double-tap toggles to (from 1x), matching common gallery apps. */
export const LIGHTBOX_DOUBLE_TAP_SCALE = 2.5

/** Clamp a scale value into the allowed zoom range. */
export function clampScale(scale: number, min = LIGHTBOX_MIN_SCALE, max = LIGHTBOX_MAX_SCALE): number {
  return Math.min(max, Math.max(min, scale))
}

export interface Vec2 {
  x: number
  y: number
}

export interface ZoomState {
  scale: number
  translateX: number
  translateY: number
}

/**
 * Recompute translate so the point under `focal` (in viewport coordinates,
 * relative to the viewport's center) stays visually fixed while the scale
 * changes from `prevScale` to `nextScale`. This is what makes pinch-zoom
 * and double-tap zoom feel anchored to the fingers/tap point instead of
 * always zooming from the image center.
 */
export function zoomAroundPoint(state: ZoomState, focal: Vec2, nextScale: number): ZoomState {
  const clamped = clampScale(nextScale)
  if (clamped === state.scale) return state
  const ratio = clamped / state.scale
  return {
    scale: clamped,
    translateX: focal.x - ratio * (focal.x - state.translateX),
    translateY: focal.y - ratio * (focal.y - state.translateY),
  }
}

/**
 * Clamp pan translation so the zoomed image can't be dragged past its own
 * edges into empty backdrop. `contentSize`/`viewportSize` are the natural
 * (unscaled) dimensions along one axis; `scale` is the current zoom level.
 */
export function clampTranslate(translate: number, contentSize: number, viewportSize: number, scale: number): number {
  const scaledSize = contentSize * scale
  // Content smaller than the viewport (or exactly at rest) never pans — stay centered.
  if (scaledSize <= viewportSize) return 0
  const maxOffset = (scaledSize - viewportSize) / 2
  return Math.min(maxOffset, Math.max(-maxOffset, translate))
}

/** Euclidean distance between two touch points — the pinch "spread". */
export function touchDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Midpoint between two touch points — the pinch focal point. */
export function touchMidpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * Given the current scale, decide the next double-tap target: zoomed-in
 * images reset to 1x, resting images jump to LIGHTBOX_DOUBLE_TAP_SCALE.
 */
export function nextDoubleTapScale(currentScale: number): number {
  return currentScale > LIGHTBOX_MIN_SCALE ? LIGHTBOX_MIN_SCALE : LIGHTBOX_DOUBLE_TAP_SCALE
}

/**
 * Swipe-to-dismiss gate: only a downward, mostly-vertical, sufficiently
 * long drag while the image is at rest (scale 1x, so pan gestures at zoom
 * don't fight the dismiss gesture) should close the lightbox.
 */
export function shouldDismissOnSwipe(deltaX: number, deltaY: number, scale: number, thresholdPx: number): boolean {
  if (scale > LIGHTBOX_MIN_SCALE) return false
  if (deltaY < thresholdPx) return false
  return Math.abs(deltaY) > Math.abs(deltaX) * 1.5
}
