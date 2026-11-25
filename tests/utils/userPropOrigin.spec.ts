import { describe, it, expect } from 'vitest'
import { canUnequipUserProp, isOriginalSignature, isRareId } from '../../app/utils/userPropOrigin'

describe('userPropOrigin', () => {
  it('flags only the original-signature origin', () => {
    expect(isOriginalSignature({ origin: 'original_signature' })).toBe(true)
    expect(isOriginalSignature({ origin: 'mall' })).toBe(false)
    expect(isOriginalSignature({ origin: 'pretty_id' })).toBe(false)
  })

  it('flags only the rare_id origin', () => {
    expect(isRareId({ origin: 'rare_id' })).toBe(true)
    expect(isRareId({ origin: 'pretty_id' })).toBe(false)
    expect(isRareId({ origin: 'mall' })).toBe(false)
    expect(isRareId({ origin: 'original_signature' })).toBe(false)
  })

  it('allows unequip only on an equipped, non-original row', () => {
    expect(canUnequipUserProp({ origin: 'mall', is_equipped: true })).toBe(true)
    expect(canUnequipUserProp({ origin: 'pretty_id', is_equipped: true })).toBe(true)
    expect(canUnequipUserProp({ origin: 'rare_id', is_equipped: true })).toBe(true)
    expect(canUnequipUserProp({ origin: 'mall', is_equipped: false })).toBe(false)
    expect(canUnequipUserProp({ origin: 'original_signature', is_equipped: true })).toBe(false)
  })
})
