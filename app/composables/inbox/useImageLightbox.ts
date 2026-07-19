/**
 * Image Lightbox (dm-messenger-v2/03)
 *
 * Ephemeral UI state + gesture orchestration for the full-screen DM image
 * viewer: open/close, pinch-zoom, double-tap zoom, one-finger pan when
 * zoomed, and swipe-down-to-dismiss when at rest. Not persisted, not
 * shared — local refs live per mounted lightbox instance (thread-panel
 * owns the single instance for the panel).
 *
 * GATE:    shouldDismissOnSwipe()/clampScale() (pure, in image-zoom-math.ts)
 *          decide whether a gesture ends in a dismiss/zoom-clamp.
 * EXECUTE: pointer/touch handlers mutate scale/translate/open state.
 * REACT:   body scroll lock toggles alongside `isOpen`.
 */
import {
  clampScale,
  clampTranslate,
  nextDoubleTapScale,
  shouldDismissOnSwipe,
  touchDistance,
  touchMidpoint,
  type Vec2,
} from '~/utils/image-zoom-math'
import { LIGHTBOX_DOUBLE_TAP_WINDOW_MS, LIGHTBOX_SWIPE_DISMISS_THRESHOLD_PX } from '~/constants/inbox'

export function useImageLightbox() {
  // ── State (ephemeral, local — not store) ──────────────
  const isOpen = ref(false)
  const imageUrl = ref<string | null>(null)
  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)

  // Natural image size + viewport size, needed to clamp pan within bounds.
  let contentWidth = 0
  let contentHeight = 0
  let viewportWidth = 0
  let viewportHeight = 0

  // Gesture bookkeeping (not reactive — pure pointer-tracking scratch state).
  let pinchStartDistance = 0
  let pinchStartScale = 1
  let panStartX = 0
  let panStartY = 0
  let panOriginX = 0
  let panOriginY = 0
  let isPanning = false
  let swipeStartY = 0
  let swipeStartX = 0
  let lastTapAt = 0
  let previousBodyOverflow = ''

  // ── EXECUTE: open/close ────────────────────────────────
  function open(url: string): void {
    imageUrl.value = url
    scale.value = 1
    translateX.value = 0
    translateY.value = 0
    isOpen.value = true
    lockBodyScroll()
  }

  function close(): void {
    isOpen.value = false
    imageUrl.value = null
    unlockBodyScroll()
  }

  // ── REACT: body scroll lock alongside open state ──────
  function lockBodyScroll(): void {
    if (typeof document === 'undefined') return
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  function unlockBodyScroll(): void {
    if (typeof document === 'undefined') return
    document.body.style.overflow = previousBodyOverflow
  }

  // ── EXECUTE: report the mounted image/viewport size ────
  // Called by the component on image load + resize so pan clamping has
  // real dimensions to work with.
  function setDimensions(content: { width: number; height: number }, viewport: { width: number; height: number }): void {
    contentWidth = content.width
    contentHeight = content.height
    viewportWidth = viewport.width
    viewportHeight = viewport.height
  }

  function applyClamp(): void {
    translateX.value = clampTranslate(translateX.value, contentWidth, viewportWidth, scale.value)
    translateY.value = clampTranslate(translateY.value, contentHeight, viewportHeight, scale.value)
  }

  // ── EXECUTE: pinch-zoom (two touches) ──────────────────
  function onPinchStart(a: Vec2, b: Vec2): void {
    pinchStartDistance = touchDistance(a, b)
    pinchStartScale = scale.value
  }

  function onPinchMove(a: Vec2, b: Vec2, viewportOrigin: Vec2): void {
    if (pinchStartDistance === 0) return
    const distance = touchDistance(a, b)
    const ratio = distance / pinchStartDistance
    const focal = touchMidpoint(a, b)
    const focalRelative: Vec2 = { x: focal.x - viewportOrigin.x, y: focal.y - viewportOrigin.y }
    const next = clampScale(pinchStartScale * ratio)
    scale.value = next
    // Re-anchor translate around the pinch midpoint each move for a natural feel.
    translateX.value = focalRelative.x - ratio * (focalRelative.x - translateX.value)
    translateY.value = focalRelative.y - ratio * (focalRelative.y - translateY.value)
    applyClamp()
  }

  function onPinchEnd(): void {
    pinchStartDistance = 0
    if (scale.value <= 1) {
      scale.value = 1
      translateX.value = 0
      translateY.value = 0
    }
  }

  // ── EXECUTE: double-tap zoom ────────────────────────────
  function onTap(point: Vec2, viewportOrigin: Vec2): void {
    const now = Date.now()
    const isDoubleTap = now - lastTapAt <= LIGHTBOX_DOUBLE_TAP_WINDOW_MS
    lastTapAt = isDoubleTap ? 0 : now
    if (!isDoubleTap) return

    const target = nextDoubleTapScale(scale.value)
    const focal: Vec2 = { x: point.x - viewportOrigin.x, y: point.y - viewportOrigin.y }
    if (target === 1) {
      scale.value = 1
      translateX.value = 0
      translateY.value = 0
      return
    }
    const ratio = target / scale.value
    scale.value = target
    translateX.value = focal.x - ratio * (focal.x - translateX.value)
    translateY.value = focal.y - ratio * (focal.y - translateY.value)
    applyClamp()
  }

  // ── EXECUTE: one-finger pan (only while zoomed) ────────
  function onPanStart(point: Vec2): void {
    if (scale.value <= 1) return
    isPanning = true
    panStartX = point.x
    panStartY = point.y
    panOriginX = translateX.value
    panOriginY = translateY.value
  }

  function onPanMove(point: Vec2): void {
    if (!isPanning) return
    translateX.value = panOriginX + (point.x - panStartX)
    translateY.value = panOriginY + (point.y - panStartY)
    applyClamp()
  }

  function onPanEnd(): void {
    isPanning = false
  }

  // ── EXECUTE + GATE: swipe-down-to-dismiss (only at rest) ─
  function onSwipeStart(point: Vec2): void {
    swipeStartX = point.x
    swipeStartY = point.y
  }

  /** Returns true if the drag should visually track a dismiss (image follows the finger). */
  function onSwipeMove(point: Vec2): { dragging: boolean; offsetY: number } {
    if (scale.value > 1) return { dragging: false, offsetY: 0 }
    const deltaY = point.y - swipeStartY
    if (deltaY <= 0) return { dragging: false, offsetY: 0 }
    return { dragging: true, offsetY: deltaY }
  }

  /** Call on gesture end — closes the lightbox if the swipe crossed the dismiss threshold. */
  function onSwipeEnd(point: Vec2): boolean {
    const deltaX = point.x - swipeStartX
    const deltaY = point.y - swipeStartY
    if (shouldDismissOnSwipe(deltaX, deltaY, scale.value, LIGHTBOX_SWIPE_DISMISS_THRESHOLD_PX)) {
      close()
      return true
    }
    return false
  }

  return {
    // State
    isOpen,
    imageUrl,
    scale,
    translateX,
    translateY,
    // Open/close
    open,
    close,
    // Sizing
    setDimensions,
    // Gestures
    onPinchStart,
    onPinchMove,
    onPinchEnd,
    onTap,
    onPanStart,
    onPanMove,
    onPanEnd,
    onSwipeStart,
    onSwipeMove,
    onSwipeEnd,
  }
}
