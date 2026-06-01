import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('h3', () => ({
  sendRedirect: vi.fn().mockResolvedValue(undefined),
}))

describe('/go/android redirect route', () => {
  let handler: (event: unknown) => Promise<void>
  let sendRedirectMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    ;(globalThis as Record<string, unknown>).defineEventHandler = vi.fn().mockImplementation(
      (fn: (...args: unknown[]) => unknown) => fn,
    )

    vi.resetModules()

    const h3 = await import('h3')
    sendRedirectMock = h3.sendRedirect as ReturnType<typeof vi.fn>
    sendRedirectMock.mockClear()

    const mod = await import('../../server/routes/go/android')
    handler = mod.default as (event: unknown) => Promise<void>
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'defineEventHandler')
    Reflect.deleteProperty(globalThis, 'useRuntimeConfig')
    vi.resetModules()
  })

  it('redirects to NUXT_PLAY_STORE_URL when configured', async () => {
    const storeUrl = 'https://play.google.com/store/apps/details?id=com.flylive.app'
    ;(globalThis as Record<string, unknown>).useRuntimeConfig = () => ({ playStoreUrl: storeUrl })

    const mockEvent = {}
    await handler(mockEvent)

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, storeUrl, 302)
  })

  it('falls back to /sign-up when playStoreUrl is empty string', async () => {
    ;(globalThis as Record<string, unknown>).useRuntimeConfig = () => ({ playStoreUrl: '' })

    const mockEvent = {}
    await handler(mockEvent)

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/sign-up', 302)
  })

  it('falls back to /sign-up when playStoreUrl is unset', async () => {
    ;(globalThis as Record<string, unknown>).useRuntimeConfig = () => ({ playStoreUrl: undefined })

    const mockEvent = {}
    await handler(mockEvent)

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/sign-up', 302)
  })
})
