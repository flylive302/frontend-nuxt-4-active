import { describe, expect, it } from 'vitest'
import { isSignatureText, normalizeSignatureInput } from '~/utils/pretty-id-signature'

describe('normalizeSignatureInput', () => {
  it('uppercases letters as typed (abc = ABC)', () => {
    expect(normalizeSignatureInput('abc', 6)).toBe('ABC')
    expect(normalizeSignatureInput('aB1c', 6)).toBe('AB1C')
  })

  it('strips symbols, spaces and non-ASCII letters', () => {
    expect(normalizeSignatureInput('a-b c_1!', 6)).toBe('ABC1')
    expect(normalizeSignatureInput('ßaı', 6)).toBe('A')
    expect(normalizeSignatureInput('١٢', 6)).toBe('')
  })

  it('caps at the tier length, after stripping', () => {
    expect(normalizeSignatureInput('ab12cdef', 6)).toBe('AB12CD')
    expect(normalizeSignatureInput('a-b-1-2-c-d-e', 4)).toBe('AB12')
  })

  it('keeps leading zeros', () => {
    expect(normalizeSignatureInput('007', 6)).toBe('007')
  })

  it('maps "ab12cd" on tier 6 to the exact value sent to the API', () => {
    expect(normalizeSignatureInput('ab12cd', 6)).toBe('AB12CD')
  })
})

describe('isSignatureText', () => {
  it.each(['123456', 'abc', 'AB12cd', '007'])('accepts %s', (q) => {
    expect(isSignatureText(q)).toBe(true)
  })

  it.each(['', 'ab-1', 'a b', 'ßss', 'ı'])('rejects %j', (q) => {
    expect(isSignatureText(q)).toBe(false)
  })
})
