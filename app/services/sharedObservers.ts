/**
 * Shared Observers
 *
 * One IntersectionObserver and one ResizeObserver for the whole app, instead
 * of one per component instance. Names render by the dozen (30 seats, the
 * chat window, member/ranking lists); a single observer with many targets is
 * cheaper than many observers with one target each, and lets resize work be
 * batched into a single animation frame.
 *
 * Framework-free: no Vue, no stores. Components reach it through
 * `useInViewport` / `useSharedResize` (composables/shared), which handle
 * mount/unmount.
 *
 * One listener per element per observer — registering the same element again
 * replaces its listener. Each `observe*` returns its own `stop()`.
 */

// ========================================
// Types
// ========================================

export type VisibilityListener = (visible: boolean) => void
export type ResizeListener = () => void

// ========================================
// State
// ========================================

const visibilityListeners = new Map<Element, VisibilityListener>()
const resizeListeners = new Map<Element, ResizeListener>()
const pendingResize = new Set<Element>()

let intersectionObserver: IntersectionObserver | null = null
let resizeObserver: ResizeObserver | null = null
let resizeFrame: number | null = null

// ========================================
// Visibility
// ========================================

function getIntersectionObserver(): IntersectionObserver {
  intersectionObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      visibilityListeners.get(entry.target)?.(entry.isIntersecting)
    }
  })
  return intersectionObserver
}

/**
 * Call `listener` with the element's on-screen state now (the observer's
 * initial entry) and on every change. Clipping by scroll containers counts —
 * an item scrolled out of a list reports `false`.
 */
export function observeVisibility(el: Element, listener: VisibilityListener): () => void {
  const observer = getIntersectionObserver()
  // Re-observe so a replaced listener still receives a fresh initial entry.
  if (visibilityListeners.has(el)) observer.unobserve(el)
  visibilityListeners.set(el, listener)
  observer.observe(el)

  return () => {
    if (visibilityListeners.get(el) !== listener) return
    visibilityListeners.delete(el)
    observer.unobserve(el)
  }
}

// ========================================
// Resize
// ========================================

/**
 * Deliver on the NEXT frame, never inside the observer callback: a listener
 * that changes layout synchronously (e.g. toggling a marquee) would resize an
 * observed element again in the same frame and trip the browser's
 * "ResizeObserver loop completed with undelivered notifications" error.
 */
function flushResize(): void {
  resizeFrame = null
  const targets = [...pendingResize]
  pendingResize.clear()
  for (const el of targets) resizeListeners.get(el)?.()
}

function getResizeObserver(): ResizeObserver {
  resizeObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) pendingResize.add(entry.target)
    resizeFrame ??= requestAnimationFrame(flushResize)
  })
  return resizeObserver
}

/**
 * Call `listener` (on the next animation frame, batched with every other
 * resized element) once after observing — if the element renders with a
 * non-zero size — and whenever its box size changes. Non-replaced inline
 * elements never report a size; observe a block.
 */
export function observeResize(el: Element, listener: ResizeListener): () => void {
  const observer = getResizeObserver()
  if (resizeListeners.has(el)) observer.unobserve(el)
  resizeListeners.set(el, listener)
  observer.observe(el)

  return () => {
    if (resizeListeners.get(el) !== listener) return
    resizeListeners.delete(el)
    pendingResize.delete(el)
    observer.unobserve(el)
  }
}

/** Test-only: drop all singleton state between cases. */
export function __resetForTest(): void {
  visibilityListeners.clear()
  resizeListeners.clear()
  pendingResize.clear()
  intersectionObserver = null
  resizeObserver = null
  resizeFrame = null
}
