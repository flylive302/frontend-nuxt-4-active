/**
 * A one-shot confetti burst for the claim celebration.
 *
 * `canvas-confetti` is imported on demand so it never weighs on the event's
 * first load, and is skipped entirely under `prefers-reduced-motion`.
 * Purely decorative (REACT): a failure is logged and swallowed.
 */

import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdConfetti]')

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const BURST = {
  particleCount: 140,
  spread: 80,
  startVelocity: 45,
  origin: { y: 0.6 },
  colors: ['#f6d078', '#e0a83a', '#fff3c0', '#b98cff'],
  /** Above the celebration layer (z-40), below nothing else. */
  zIndex: 100,
  /** The library's own switch, in case the media query is not reachable. */
  disableForReducedMotion: true,
} as const

export function usePrettyIdConfetti() {
  function prefersReducedMotion(): boolean {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches
  }

  async function fireConfetti(): Promise<void> {
    // GATE
    if (prefersReducedMotion()) return
    // EXECUTE
    try {
      const { default: confetti } = await import('canvas-confetti')
      await confetti({ ...BURST, colors: [...BURST.colors] })
    } catch (err) {
      // REACT — decoration only
      log.warn('Confetti failed', err)
    }
  }

  return { fireConfetti }
}
