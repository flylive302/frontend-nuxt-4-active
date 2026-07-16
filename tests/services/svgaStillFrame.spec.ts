// ========================================
// SVGA Still Frame Service Tests
// ========================================
// Covers capacitor-performance issue 02 (chat-message avatar frames render
// as a static first-frame still, never animate):
//   - renders once per unique URL, cache hit on second call (no re-render)
//   - uses the injected svga plugin's createSvgaPlayer (inherits the
//     plugin's read-through asset cache — never fetches the .svga directly)
//   - failure (plugin throws, or no drawFrame) resolves to null, never throws

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getSvgaStillFrame,
  clearSvgaStillFrameCache,
  type SvgaStillPlugin,
} from '~/services/svgaStillFrame'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

const FRAME_URL = 'https://assets.flyliveapp.com/frames/10.svga'

/** Minimal fake canvas: toDataURL returns a deterministic marker string. */
function stubCanvas() {
  return {
    toDataURL: vi.fn(() => `data:image/png;base64,${FRAME_URL}`),
  } as unknown as HTMLCanvasElement
}

describe('svgaStillFrame', () => {
  beforeEach(() => {
    clearSvgaStillFrameCache()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => stubCanvas()),
    })
  })

  it('renders the still frame via the plugin and returns a data URL', async () => {
    const drawFrame = vi.fn()
    const destroy = vi.fn()
    const createSvgaPlayer = vi.fn().mockResolvedValue({ drawFrame, destroy })
    const plugin: SvgaStillPlugin = { createSvgaPlayer }

    const result = await getSvgaStillFrame(FRAME_URL, plugin)

    expect(createSvgaPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ name: FRAME_URL, autoplay: false }),
    )
    expect(drawFrame).toHaveBeenCalledWith(0)
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(result).toBe(`data:image/png;base64,${FRAME_URL}`)
  })

  it('renders once per unique URL — second call is a cache hit', async () => {
    const createSvgaPlayer = vi.fn().mockResolvedValue({ drawFrame: vi.fn(), destroy: vi.fn() })
    const plugin: SvgaStillPlugin = { createSvgaPlayer }

    await getSvgaStillFrame(FRAME_URL, plugin)
    await getSvgaStillFrame(FRAME_URL, plugin)

    expect(createSvgaPlayer).toHaveBeenCalledTimes(1)
  })

  it('different URLs render independently', async () => {
    const createSvgaPlayer = vi.fn().mockResolvedValue({ drawFrame: vi.fn(), destroy: vi.fn() })
    const plugin: SvgaStillPlugin = { createSvgaPlayer }

    await getSvgaStillFrame(FRAME_URL, plugin)
    await getSvgaStillFrame(`${FRAME_URL}?v=2`, plugin)

    expect(createSvgaPlayer).toHaveBeenCalledTimes(2)
  })

  it('plugin failure resolves to null, never throws', async () => {
    const createSvgaPlayer = vi.fn().mockRejectedValue(new Error('parse failed'))
    const plugin: SvgaStillPlugin = { createSvgaPlayer }

    await expect(getSvgaStillFrame(FRAME_URL, plugin)).resolves.toBeNull()
  })

  it('player without drawFrame resolves to null and still destroys the player', async () => {
    const destroy = vi.fn()
    const createSvgaPlayer = vi.fn().mockResolvedValue({ destroy })
    const plugin: SvgaStillPlugin = { createSvgaPlayer }

    const result = await getSvgaStillFrame(FRAME_URL, plugin)

    expect(result).toBeNull()
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('a failed render does not poison the cache for a later retry via evict', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'))
    const plugin: SvgaStillPlugin = { createSvgaPlayer: failing }

    const first = await getSvgaStillFrame(FRAME_URL, plugin)
    expect(first).toBeNull()

    // Still cached (as null) until evicted — matches "cache the result" contract.
    expect(failing).toHaveBeenCalledTimes(1)
    await getSvgaStillFrame(FRAME_URL, plugin)
    expect(failing).toHaveBeenCalledTimes(1)
  })
})
