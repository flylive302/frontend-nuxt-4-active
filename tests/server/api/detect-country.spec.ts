import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'

const getRequestIPMock = vi.fn<(event: any, opts?: any) => string | null>()

vi.mock('h3', () => ({
  getRequestIP: getRequestIPMock
}))

describe('detect-country handler', () => {
  let handler: (event: any) => Promise<{ country_code: string | null }>

  beforeEach(async () => {
    await vi.resetModules()
    getRequestIPMock.mockReset()
    ;(globalThis as any).defineEventHandler = (fn: any) => fn
    ;(globalThis as any).$fetch = vi.fn()
    handler = (await import('../../../server/api/detect-country')).default
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (globalThis as any).defineEventHandler
    delete (globalThis as any).$fetch
  })

  it('returns null for localhost addresses', async () => {
    getRequestIPMock.mockReturnValueOnce('127.0.0.1')

    await expect(handler({} as any)).resolves.toEqual({ country_code: null })
    expect(globalThis.$fetch).not.toHaveBeenCalled()
  })

  it('fetches GeoJS for non-localhost addresses', async () => {
    const fetchMock = globalThis.$fetch as unknown as Mock<[string], Promise<{ country: string }>>
    fetchMock.mockResolvedValueOnce({ country: 'us' })
    getRequestIPMock.mockReturnValueOnce('203.0.113.5')

    await expect(handler({} as any)).resolves.toEqual({ country_code: 'US' })
    expect(fetchMock).toHaveBeenCalledWith('https://get.geojs.io/v1/ip/country/203.0.113.5.json')
  })
})
