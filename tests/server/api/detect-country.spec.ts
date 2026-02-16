import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import type { H3Event } from 'h3'

const getRequestIPMock = vi.fn()
const getHeaderMock = vi.fn()

vi.mock('h3', () => ({
  getRequestIP: getRequestIPMock,
  getHeader: getHeaderMock
}))

describe('detect-country handler', () => {
  let handler: (event: H3Event) => Promise<{ country_code: string | null }>

  beforeEach(async () => {
    vi.clearAllMocks()
    await vi.resetModules()
    
    // Default mocks
    getRequestIPMock.mockReturnValue(null)
    getHeaderMock.mockReturnValue(null)

    // Setup global context for Nuxt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).defineEventHandler = (fn: any) => fn
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

  it('prioritizes cf-ipcountry header if present', async () => {
    getHeaderMock.mockReturnValue('FR')
    
    const result = await handler({} as H3Event)
    
    expect(result).toEqual({ country_code: 'FR' })
    expect(getHeaderMock).toHaveBeenCalledWith(expect.anything(), 'cf-ipcountry')
    // Should NOT fetch geojs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).$fetch).not.toHaveBeenCalled()
  })

  it('ignores invalid cf-ipcountry header values', async () => {
    getHeaderMock.mockReturnValue('XX') // existing logic ignores 'XX'
    
    // returns null if no IP fallback
    const result = await handler({} as H3Event)
    expect(result).toEqual({ country_code: null })
  })

  it('returns null for localhost addresses when no cf-ipcountry', async () => {
    getRequestIPMock.mockReturnValue('127.0.0.1')
    getHeaderMock.mockReturnValue(null)

    await expect(handler({} as H3Event)).resolves.toEqual({ country_code: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).$fetch).not.toHaveBeenCalled()
  })

  it('fetches GeoJS for non-localhost addresses when no cf-ipcountry', async () => {
    getHeaderMock.mockReturnValue(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = (globalThis as any).$fetch as unknown as Mock
    fetchMock.mockResolvedValueOnce({ country: 'us' })
    getRequestIPMock.mockReturnValue('203.0.113.5')

    await expect(handler({} as H3Event)).resolves.toEqual({ country_code: 'US' })
    
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://get.geojs.io/v1/ip/country/203.0.113.5.json'),
      expect.objectContaining({ timeout: 3000 })
    )
  })
})
