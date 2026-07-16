// ========================================
// SVGA Still Frame Service
// ========================================
// Services = Low-level infra (canvas render, caching). No store imports, no
// Vue reactivity, no Nuxt runtime imports — the svga plugin handle is passed
// in by the caller (composable layer), same pattern as giftAssetCache.ts.
//
// Renders the FIRST frame of an SVGA animation to a static data URL, once per
// unique frame URL, and caches the result in a module-level Map so any number
// of consumers (e.g. N chat messages sharing the same equipped frame) reuse
// a single render instead of paying decode + canvas cost repeatedly.
//
// Used for chat-message avatar frames (capacitor-performance issue 02): the
// frame is visually present but never animates there, so no SvgaPlayer
// instance is mounted per message.

import { createLogger } from '~/utils/logger'

const log = createLogger('[SvgaStillFrame]')

/** Minimal shape of the svga plugin's `createSvgaPlayer` needed to render a single frame. */
export interface SvgaStillPlugin {
  createSvgaPlayer: (options: {
    canvas: HTMLCanvasElement
    name: string
    autoplay?: boolean
  }) => Promise<SvgaStillPlayerHandle>
}

/**
 * The svga lib's `Player` type-hides `drawFrame` as private (TS-only), but it
 * is a plain method at runtime. Declared narrowly here — only the two calls
 * this service makes — rather than importing the lib's internal class type.
 */
interface SvgaStillPlayerHandle {
  drawFrame?: (frame: number) => void
  destroy: () => void
}

/** First-frame index — the still is always the animation's opening frame. */
const STILL_FRAME_INDEX = 0

/** Image MIME type used for the exported still. */
const STILL_FRAME_MIME = 'image/png'

/**
 * URL -> rendered still (data URL), or `null` on render failure.
 * Module-level singleton: one render per unique frame URL across the app.
 */
const stillCache = new Map<string, Promise<string | null>>()

/**
 * Get (or render, once, then cache) a static data-URL still of an SVGA's
 * first frame. Failures resolve to `null` — never throw — so callers can
 * fall back to hiding the overlay without an unhandled rejection.
 */
export function getSvgaStillFrame(url: string, svgaPlugin: SvgaStillPlugin): Promise<string | null> {
  const cached = stillCache.get(url)
  if (cached) return cached

  const renderPromise = renderStillFrame(url, svgaPlugin).catch((error) => {
    log.warn('Failed to render SVGA still frame', url, error)
    return null
  })

  stillCache.set(url, renderPromise)
  return renderPromise
}

/** Drop a cached still (e.g. if a render later turns out corrupt) so the next call re-renders. */
export function evictSvgaStillFrame(url: string): void {
  stillCache.delete(url)
}

/** Clear every cached still. Exposed for tests; not expected to be called in app code. */
export function clearSvgaStillFrameCache(): void {
  stillCache.clear()
}

async function renderStillFrame(url: string, svgaPlugin: SvgaStillPlugin): Promise<string | null> {
  const canvas = document.createElement('canvas')
  const player = await svgaPlugin.createSvgaPlayer({ canvas, name: url, autoplay: false })

  try {
    if (typeof player.drawFrame !== 'function') {
      log.warn('SVGA player has no drawFrame method, cannot render still', url)
      return null
    }
    player.drawFrame(STILL_FRAME_INDEX)
    return canvas.toDataURL(STILL_FRAME_MIME)
  } finally {
    player.destroy()
  }
}
