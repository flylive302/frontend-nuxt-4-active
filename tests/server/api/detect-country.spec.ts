import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import type { H3Event } from 'h3'

const getRequestIPMock = vi.fn<(event: unknown, opts?: unknown) => string | null>()

vi.mock('h3', () => ({
  getRequestIP: getRequestIPMock
}))

describe('detect-country handler', () => {
  let handler: (event: H3Event) => Promise<{ country_code: string | null }>

  beforeEach(async () => {
    await vi.resetModules()
    getRequestIPMock.mockReset()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).defineEventHandler = (fn: unknown) => fn
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).$fetch = vi.fn()
    handler = (await import('../../../server/api/detect-country')).default
  })

  afterEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).defineEventHandler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).$fetch
  })

  it('returns null for localhost addresses', async () => {
    getRequestIPMock.mockReturnValueOnce('127.0.0.1')

    await expect(handler({} as unknown as H3Event)).resolves.toEqual({ country_code: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).$fetch).not.toHaveBeenCalled()
  })

  it('fetches GeoJS for non-localhost addresses', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = (globalThis as any).$fetch as unknown as Mock
    fetchMock.mockResolvedValueOnce({ country: 'us' })
    getRequestIPMock.mockReturnValueOnce('203.0.113.5')

    await expect(handler({} as unknown as H3Event)).resolves.toEqual({ country_code: 'US' })
    expect(fetchMock).toHaveBeenCalledWith('https://get.geojs.io/v1/ip/country/203.0.113.5.json')
  })
})
