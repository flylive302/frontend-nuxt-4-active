import { describe, expect, it } from 'vitest'
import { readErrorCode } from '~/utils/api/readErrorCode'

describe('readErrorCode', () => {
  it('prefers the normalised errorCode', () => {
    expect(readErrorCode({ message: 'x', errorCode: 'A', meta: { error_code: 'B' } })).toBe('A')
  })

  it('falls back to meta.error_code', () => {
    expect(readErrorCode({ message: 'x', meta: { error_code: 'B' } })).toBe('B')
  })

  it('digs the raw response body (the normalizer drops it on 422)', () => {
    const raw = { response: { _data: { errors: { error_code: 'C' } } } }
    expect(readErrorCode({ message: 'x', status: 422, raw })).toBe('C')
  })

  it('is undefined when there is no string code anywhere', () => {
    expect(readErrorCode({ message: 'x' })).toBeUndefined()
    expect(readErrorCode({ message: 'x', meta: { error_code: 5 }, raw: { response: { _data: { errors: { error_code: 7 } } } } })).toBeUndefined()
  })
})
