import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * observability-audio-quality/12.
 *
 * The probe used to issue a bare RELATIVE fetch to the v1 health path, which
 * resolves against the FRONTEND's origin — where nothing serves it. It was
 * broken in opposite directions per platform (web: the SPA fallback answered, so
 * it reported "online" with the API down; native: nothing answered, so Retry on
 * the offline screen could never succeed).
 *
 * These tests pin that it goes through the shared client, which is what makes it
 * hit the real API origin on BOTH platforms — and carry the correlation headers.
 */

let apiMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  apiMock = vi.fn().mockResolvedValue({})
  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useApi')
})

describe('useConnectivityProbe', () => {
  it('probes through the shared API client, not a bare relative fetch', async () => {
    const { useConnectivityProbe } = await import('~/composables/shared/useConnectivityProbe')

    await useConnectivityProbe().probeHealth()

    expect(apiMock).toHaveBeenCalledTimes(1)
  })

  it('targets a path RELATIVE TO apiBase, so it resolves to the API on both platforms', async () => {
    const { useConnectivityProbe } = await import('~/composables/shared/useConnectivityProbe')

    await useConnectivityProbe().probeHealth()

    // `apiBase` already ends in `/api/v1`, so the correct path is bare `/health`.
    // A leading `/api/v1` here would double the prefix; the old absolute-looking
    // relative path is exactly what made this unreachable.
    expect(apiMock.mock.calls[0]?.[0]).toBe('/health')
  })

  it('keeps the original 5s budget rather than inheriting the longer client default', async () => {
    const { useConnectivityProbe } = await import('~/composables/shared/useConnectivityProbe')

    await useConnectivityProbe().probeHealth()

    expect((apiMock.mock.calls[0]?.[1] as { timeout?: number })?.timeout).toBe(5000)
  })

  it('reports reachable when the health endpoint answers', async () => {
    const { useConnectivityProbe } = await import('~/composables/shared/useConnectivityProbe')

    await expect(useConnectivityProbe().probeHealth()).resolves.toBe(true)
  })

  it('reports unreachable instead of throwing when the request fails', async () => {
    // The offline page awaits this directly; a rejection would break Retry.
    apiMock.mockRejectedValue(new Error('network down'))
    const { useConnectivityProbe } = await import('~/composables/shared/useConnectivityProbe')

    await expect(useConnectivityProbe().probeHealth()).resolves.toBe(false)
  })
})
