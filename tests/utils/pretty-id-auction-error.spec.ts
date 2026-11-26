import { describe, expect, it } from 'vitest'
import { PrettyIdAuctionApiError, toPrettyIdAuctionError } from '~/utils/pretty-id-auction-error'

/** What ofetch rejects with for an HTTP error: status + parsed body on `response`. */
function httpError(status: number, errorCode?: string) {
  return {
    message: 'Nope',
    response: {
      status,
      _data: { status: 'error', message: 'Nope', data: null, errors: errorCode ? { error_code: errorCode } : null },
    },
  }
}

describe('toPrettyIdAuctionError', () => {
  it.each([
    ['staff_not_allowed', 403, 'Staff accounts can watch but not take part.'],
    ['disqualified', 403, 'You were disqualified from this auction.'],
    ['auction_not_live', 409, 'This auction is not live right now.'],
    ['already_entered', 409, 'You have already entered this auction.'],
    ['insufficient_coins', 422, 'Not enough coins to pay the entry fee.'],
    ['auction_ended', 409, 'This auction has ended.'],
    ['entry_required', 403, 'Pay the entry fee to bid.'],
    ['already_highest', 409, 'You are already the highest bidder.'],
    ['bid_too_low', 409, 'Someone bid first. Your bid is now too low.'],
    ['invalid', 422, 'Enter a whole number of coins.'],
  ])('maps error_code %s (HTTP %i) to its code and message', (code, status, message) => {
    const error = toPrettyIdAuctionError(httpError(status, code))
    expect(error).toBeInstanceOf(PrettyIdAuctionApiError)
    expect(error).toMatchObject({ code, message })
  })

  it('reads min_next_bid off a bid_too_low refusal', () => {
    const body = { status: 'error', message: 'x', data: null, errors: { error_code: 'bid_too_low', min_next_bid: 200_000 } }
    const error = toPrettyIdAuctionError({ message: 'x', response: { status: 409, _data: body } })
    expect(error).toMatchObject({ code: 'bid_too_low', minNextBid: 200_000 })
  })

  it.each([[0], [-5], [1.5], ['200000'], [undefined]])('ignores a bad min_next_bid (%s)', (value) => {
    const body = { errors: { error_code: 'bid_too_low', min_next_bid: value } }
    const error = toPrettyIdAuctionError({ message: 'x', response: { status: 409, _data: body } })
    expect(error.code).toBe('bid_too_low')
    expect(error.minNextBid).toBeUndefined()
  })

  it('maps a 404 to not_found by status alone (no error_code)', () => {
    expect(toPrettyIdAuctionError(httpError(404))).toMatchObject({ code: 'not_found', message: 'This auction was not found.' })
  })

  it('maps a 404 with a not_found error_code to not_found', () => {
    expect(toPrettyIdAuctionError(httpError(404, 'not_found'))).toMatchObject({ code: 'not_found' })
  })

  it('maps an unknown error_code to unknown with the generic message', () => {
    expect(toPrettyIdAuctionError(httpError(409, 'something_new'))).toMatchObject({
      code: 'unknown',
      message: 'Something went wrong. Please try again.',
    })
  })

  it('maps a 500 without a code to unknown', () => {
    expect(toPrettyIdAuctionError(httpError(500))).toMatchObject({ code: 'unknown' })
  })

  it('maps a transport failure to unknown with the connection message', () => {
    expect(toPrettyIdAuctionError(new TypeError('Failed to fetch'))).toMatchObject({
      code: 'unknown',
      message: 'Network error. Check your connection.',
    })
  })

  it('returns an existing PrettyIdAuctionApiError untouched', () => {
    const original = new PrettyIdAuctionApiError('disqualified')
    expect(toPrettyIdAuctionError(original)).toBe(original)
  })
})
