// ========================================
// useAvatarStillFrame Composable Tests
// ========================================
// Bridges UserAvatar's `staticFrame` prop to the svgaStillFrame service via
// useNuxtApp().$svga. Covers: resolves a still on URL change, clears
// immediately when the URL changes to a DIFFERENT frame, keeps the existing
// still when the URL goes null/undefined (android-client-performance/16: a
// seat flipping animated → still briefly re-requests the same URL), skips
// re-resolving when the URL returns to the one already rendered, ignores a
// stale response after the URL moved on, and no-ops gracefully when the svga
// plugin isn't available.

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

  it('keeps the resolved still when the URL goes null/undefined (android-client-performance/16)', async () => {
    getSvgaStillFrameMock.mockResolvedValue('still-for-x')
    const scope = effectScope()
    const url = ref<string | undefined>('url-x')

    const { stillUrl } = scope.run(() => useAvatarStillFrame(url))!
    await nextTick()
    await nextTick()
    expect(stillUrl.value).toBe('still-for-x')

    url.value = undefined
    await nextTick()

    expect(stillUrl.value).toBe('still-for-x')
    scope.stop()
  })

  it('does not re-resolve when the URL returns to the one already rendered', async () => {
    getSvgaStillFrameMock.mockResolvedValue('still-for-x')
    const scope = effectScope()
    const url = ref<string | undefined>('url-x')

    const { stillUrl } = scope.run(() => useAvatarStillFrame(url))!
    await nextTick()
    await nextTick()
    expect(stillUrl.value).toBe('still-for-x')

    url.value = undefined
    await nextTick()
    expect(stillUrl.value).toBe('still-for-x')

    url.value = 'url-x'
    await nextTick()
    await nextTick()

    expect(stillUrl.value).toBe('still-for-x')
    expect(getSvgaStillFrameMock).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('clears to null immediately when the URL changes to a different frame, then resolves the new still', async () => {
    let resolveY: (v: string | null) => void = () => {}
    getSvgaStillFrameMock.mockResolvedValueOnce('still-for-x')
    getSvgaStillFrameMock.mockImplementationOnce(
      () => new Promise((resolve) => { resolveY = resolve }),
    )

    const scope = effectScope()
    const url = ref<string | undefined>('url-x')
    const { stillUrl } = scope.run(() => useAvatarStillFrame(url))!
    await nextTick()
    await nextTick()
    expect(stillUrl.value).toBe('still-for-x')

    url.value = 'url-y'
    await nextTick()

    // Cleared immediately, before url-y's still resolves — one user must
    // never wear another's frame, even for a tick.
    expect(stillUrl.value).toBeNull()

    resolveY('still-for-y')
    await nextTick()
    await nextTick()

    expect(stillUrl.value).toBe('still-for-y')
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
