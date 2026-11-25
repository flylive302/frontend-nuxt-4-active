import { describe, expect, it } from 'vitest'
import { showsPrettyIdPlate } from '~/utils/pretty-id-plate'

describe('showsPrettyIdPlate', () => {
  it('shows the plate for both tiers', () => {
    expect(showsPrettyIdPlate(6)).toBe(true)
    expect(showsPrettyIdPlate(4)).toBe(true)
  })

  it('stays plain for original / mall signatures and old payloads', () => {
    expect(showsPrettyIdPlate(null)).toBe(false)
    expect(showsPrettyIdPlate(undefined)).toBe(false)
  })
})
