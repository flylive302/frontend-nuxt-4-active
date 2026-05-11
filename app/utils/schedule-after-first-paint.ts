/**
 * Defer work until after the first paint so it stays off Lighthouse's critical network chain.
 * Double rAF waits for layout/commit; idle schedules behind user-visible work.
 */
export function scheduleAfterFirstPaint(fn: () => void): void {
  if (!import.meta.client) {
    return
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const run = () => {
        fn()
      }
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(run, { timeout: 2000 })
      } else {
        setTimeout(run, 0)
      }
    })
  })
}
