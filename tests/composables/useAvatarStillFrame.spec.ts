// ========================================
// useAvatarStillFrame Composable Tests
// ========================================
// Bridges UserAvatar's `staticFrame` prop to the svgaStillFrame service via
// useNuxtApp().$svga. Covers: resolves a still on URL change, clears while
// loading a new URL, ignores a stale response after the URL moved on, and
// no-ops gracefully when the svga plugin isn't available.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useAvatarStillFrame } from '~/composables/shared/useAvatarStillFrame'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

const getSvgaStillFrameMock = vi.fn()
vi.mock('~/services/svgaStillFrame', () => ({
  getSvgaStillFrame: (...args: unknown[]) => getSvgaStillFrameMock(...args),
}))

const FAKE_SVGA_PLUGIN = { createSvgaPlayer: vi.fn() }

beforeEach(() => {
  getSvgaStillFrameMock.mockReset()
  ;(globalThis as Record<string, unknown>).useNuxtApp = () => ({ $svga: FAKE_SVGA_PLUGIN })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useNuxtApp')
})

describe('useAvatarStillFrame', () => {
  it('resolves a still for a frame URL', async () => {
    getSvgaStillFrameMock.mockResolvedValue('data:image/png;base64,still')
    const scope = effectScope()
    const url = ref<string | undefined>('https://assets.flyliveapp.com/frames/10.svga')

    const { stillUrl } = scope.run(() => useAvatarStillFrame(url))!
    await nextTick()
    await nextTick()

    expect(getSvgaStillFrameMock).toHaveBeenCalledWith(url.value, FAKE_SVGA_PLUGIN)
    expect(stillUrl.value).toBe('data:image/png;base64,still')
    scope.stop()
  })

  it('null/undefined URL resolves to no still and skips the service call', async () => {
    const scope = effectScope()
    const url = ref<string | undefined>(undefined)

    const { stillUrl } = scope.run(() => useAvatarStillFrame(url))!
    await nextTick()

    expect(getSvgaStillFrameMock).not.toHaveBeenCalled()
    expect(stillUrl.value).toBeNull()
    scope.stop()
  })

  it('a stale response is dropped once the URL has moved on', async () => {
    let resolveFirst: (v: string | null) => void = () => {}
    getSvgaStillFrameMock.mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = resolve }),
    )
    getSvgaStillFrameMock.mockResolvedValueOnce('second-still')

    const scope = effectScope()
    const url = ref<string | undefined>('url-a')
    const { stillUrl } = scope.run(() => useAvatarStillFrame(url))!
    await nextTick()

    url.value = 'url-b'
    await nextTick()
    await nextTick()

    // Second call already resolved (mockResolvedValueOnce is immediate).
    expect(stillUrl.value).toBe('second-still')

    // The stale first promise resolves after the URL has moved on — must be ignored.
    resolveFirst('stale-still')
    await nextTick()
    expect(stillUrl.value).toBe('second-still')
    scope.stop()
  })

  it('missing $svga plugin resolves to no still without throwing', async () => {
    ;(globalThis as Record<string, unknown>).useNuxtApp = () => ({})
    const scope = effectScope()
    const url = ref<string | undefined>('https://assets.flyliveapp.com/frames/10.svga')

    const { stillUrl } = scope.run(() => useAvatarStillFrame(url))!
    await nextTick()

    expect(getSvgaStillFrameMock).not.toHaveBeenCalled()
    expect(stillUrl.value).toBeNull()
    scope.stop()
  })
})
