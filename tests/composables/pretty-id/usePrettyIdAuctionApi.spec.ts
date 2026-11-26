import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrettyIdAuctionApi } from '~/composables/pretty-id/usePrettyIdAuctionApi'
import { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'
import { makeBidResult, makeEnterResult, makeList, makeMe, makeSnapshot } from '../../helpers/prettyIdAuctionFixtures'

const apiMock = vi.fn()

vi.mock('~/composables/shared/useApi', () => ({
  useApi: () => ({ api: apiMock }),
}))

/** What ofetch rejects with for an HTTP error: status + parsed body on `response`. */
function httpError(status: number, message = 'Nope') {
  return { message, response: { status, _data: { success: false, message, data: null, errors: null } } }
}

describe('usePrettyIdAuctionApi seam', () => {
  beforeEach(() => {
    apiMock.mockReset()
  })

  it('GETs /pretty-id/auctions and unwraps data', async () => {
    const list = makeList([])
    apiMock.mockResolvedValue({ data: list })
    expect(await usePrettyIdAuctionApi().auctions()).toEqual(list)
    expect(apiMock).toHaveBeenCalledWith('/pretty-id/auctions')
  })

  it('GETs /pretty-id/auctions/{id} and unwraps data', async () => {
    const snapshot = makeSnapshot({ id: 42 })
    apiMock.mockResolvedValue({ data: snapshot })
    expect(await usePrettyIdAuctionApi().auction(42)).toEqual(snapshot)
    expect(apiMock).toHaveBeenCalledWith('/pretty-id/auctions/42')
  })

  it('GETs /pretty-id/auctions/{id}/me and unwraps data', async () => {
    const me = makeMe({ entered: true, may_bid: true })
    apiMock.mockResolvedValue({ data: me })
    expect(await usePrettyIdAuctionApi().auctionMe(42)).toEqual(me)
    expect(apiMock).toHaveBeenCalledWith('/pretty-id/auctions/42/me')
  })

  it('POSTs /pretty-id/auctions/{id}/enter with no body and unwraps data', async () => {
    const result = makeEnterResult({ fee_paid: 5_000, coins: 95_000 })
    apiMock.mockResolvedValue({ data: result })
    expect(await usePrettyIdAuctionApi().enter(42)).toEqual(result)
    expect(apiMock).toHaveBeenCalledWith('/pretty-id/auctions/42/enter', { method: 'POST' })
  })

  it('POSTs /pretty-id/auctions/{id}/bid with { amount } and unwraps data', async () => {
    const result = makeBidResult({ coins: 12_345 })
    apiMock.mockResolvedValue({ data: result })
    expect(await usePrettyIdAuctionApi().bid(42, 250_000)).toEqual(result)
    expect(apiMock).toHaveBeenCalledWith('/pretty-id/auctions/42/bid', { method: 'POST', body: { amount: 250_000 } })
  })

  it('maps a bid refusal to its error_code and carries min_next_bid on bid_too_low', async () => {
    apiMock.mockRejectedValue({
      message: 'Too low',
      response: { status: 409, _data: { status: 'error', message: 'Too low', data: null, errors: { error_code: 'bid_too_low', min_next_bid: 150_000 } } },
    })
    await expect(usePrettyIdAuctionApi().bid(1, 1)).rejects.toMatchObject({ code: 'bid_too_low', minNextBid: 150_000 })
  })

  it('maps an enter refusal to its error_code', async () => {
    apiMock.mockRejectedValue({
      message: 'Not enough coins',
      response: { status: 422, _data: { status: 'error', message: 'Not enough coins', data: null, errors: { error_code: 'insufficient_coins' } } },
    })
    await expect(usePrettyIdAuctionApi().enter(1)).rejects.toMatchObject({ code: 'insufficient_coins' })
  })

  it('maps an HTTP 404 on enter to not_found', async () => {
    apiMock.mockRejectedValue(httpError(404))
    await expect(usePrettyIdAuctionApi().enter(1)).rejects.toMatchObject({ code: 'not_found' })
  })

  describe('error mapping', () => {
    it.each([
      ['auctions', (api: ReturnType<typeof usePrettyIdAuctionApi>) => api.auctions()],
      ['auction', (api: ReturnType<typeof usePrettyIdAuctionApi>) => api.auction(9)],
      ['auctionMe', (api: ReturnType<typeof usePrettyIdAuctionApi>) => api.auctionMe(9)],
    ])('maps an HTTP 404 on %s to not_found', async (_name, call) => {
      apiMock.mockRejectedValue(httpError(404))
      const err = await call(usePrettyIdAuctionApi()).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(PrettyIdAuctionApiError)
      expect(err).toMatchObject({ code: 'not_found', message: 'This auction was not found.' })
    })

    it('maps a 500 to unknown with the generic message', async () => {
      apiMock.mockRejectedValue(httpError(500, 'Server exploded: SQLSTATE[23000]'))
      await expect(usePrettyIdAuctionApi().auction(1)).rejects.toMatchObject({
        code: 'unknown',
        message: 'Something went wrong. Please try again.',
      })
    })

    it('maps a transport failure to unknown with the connection message', async () => {
      apiMock.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(usePrettyIdAuctionApi().auctions()).rejects.toMatchObject({
        code: 'unknown',
        message: 'Network error. Check your connection.',
      })
    })
  })
})
