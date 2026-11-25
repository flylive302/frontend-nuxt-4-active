import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrettyIdApi } from '~/composables/pretty-id/usePrettyIdApi'
import { PrettyIdApiError } from '~/utils/pretty-id-error'

const apiMock = vi.fn()

vi.mock('~/composables/shared/useApi', () => ({
  useApi: () => ({ api: apiMock }),
}))

/** What ofetch rejects with for an HTTP error: status + parsed body on `response`. */
function httpError(status: number, errorCode: string | null, message = 'Nope') {
  return {
    message,
    response: {
      status,
      _data: { success: false, message, data: null, errors: errorCode ? { error_code: errorCode } : null },
    },
  }
}

describe('usePrettyIdApi seam', () => {
  beforeEach(() => {
    apiMock.mockReset()
  })

  describe('me', () => {
    it('GETs /pretty-id/me and unwraps data', async () => {
      const me = { wealth_level: 5, tiers: [] }
      apiMock.mockResolvedValue({ data: me })
      expect(await usePrettyIdApi().me()).toEqual(me)
      expect(apiMock).toHaveBeenCalledWith('/pretty-id/me', {})
    })
  })

  describe('list', () => {
    const page = { items: [{ signature: '123456', category: 'lucky' }], total: 1, next_cursor: 'abc' }

    it('GETs /pretty-id/ids with the tier and unwraps data', async () => {
      apiMock.mockResolvedValue({ data: page })
      expect(await usePrettyIdApi().list({ tier: 6 })).toEqual(page)
      expect(apiMock).toHaveBeenCalledWith('/pretty-id/ids', { query: { tier: 6 } })
    })

    it('sends category, q and cursor when set', async () => {
      apiMock.mockResolvedValue({ data: page })
      await usePrettyIdApi().list({ tier: 4, category: 'legend', q: '8888', cursor: 'next' })
      expect(apiMock).toHaveBeenCalledWith('/pretty-id/ids', {
        query: { tier: 4, category: 'legend', q: '8888', cursor: 'next' },
      })
    })

    it('leaves out a null category, an empty q and a null cursor', async () => {
      apiMock.mockResolvedValue({ data: page })
      await usePrettyIdApi().list({ tier: 6, category: null, q: '', cursor: null })
      expect(apiMock).toHaveBeenCalledWith('/pretty-id/ids', { query: { tier: 6 } })
    })
  })

  describe('claim', () => {
    it('POSTs the signature to /pretty-id/claim and unwraps data', async () => {
      const result = { signature: '123456', tier: 6, category: 'lucky', user_prop_id: 9 }
      apiMock.mockResolvedValue({ data: result })
      expect(await usePrettyIdApi().claim('123456')).toEqual(result)
      expect(apiMock).toHaveBeenCalledWith('/pretty-id/claim', { method: 'POST', body: { signature: '123456' } })
    })
  })

  describe('error mapping', () => {
    it.each([
      [403, 'level_required'],
      [409, 'already_claimed'],
      [409, 'taken'],
    ])('maps %i %s onto its code', async (status, code) => {
      apiMock.mockRejectedValue(httpError(status, code))
      await expect(usePrettyIdApi().claim('123456')).rejects.toMatchObject({ code })
    })

    it('maps a 422 invalid even though the shared normalizer drops error_code there', async () => {
      apiMock.mockRejectedValue(httpError(422, 'invalid'))
      await expect(usePrettyIdApi().claim('12')).rejects.toMatchObject({ code: 'invalid' })
    })

    it('maps the browse 403 level_required', async () => {
      apiMock.mockRejectedValue(httpError(403, 'level_required'))
      await expect(usePrettyIdApi().list({ tier: 4 })).rejects.toMatchObject({ code: 'level_required' })
    })

    it('maps an unrecognised code to unknown', async () => {
      apiMock.mockRejectedValue(httpError(409, 'something_else'))
      await expect(usePrettyIdApi().claim('123456')).rejects.toMatchObject({ code: 'unknown' })
    })

    it('maps a response without a code (500) to unknown with the generic message', async () => {
      apiMock.mockRejectedValue(httpError(500, null, 'Server exploded: SQLSTATE[23000]'))
      const err = await usePrettyIdApi().me().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(PrettyIdApiError)
      expect(err).toMatchObject({ code: 'unknown', message: 'Something went wrong. Please try again.' })
    })

    it('maps a transport failure to unknown with the connection message', async () => {
      apiMock.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(usePrettyIdApi().me()).rejects.toMatchObject({
        code: 'unknown',
        message: 'Network error. Check your connection.',
      })
    })
  })
})
