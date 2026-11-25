import { describe, expect, it } from 'vitest'
import { showsPrettyIdPlate } from '~/utils/pretty-id-plate'

describe('showsPrettyIdPlate', () => {
  it('shows the plate when the server says the user wears a Pretty ID or Rare ID', () => {
    expect(showsPrettyIdPlate(true)).toBe(true)
  })

  it('stays plain for original / mall signatures and old payloads', () => {
    expect(showsPrettyIdPlate(false)).toBe(false)
    expect(showsPrettyIdPlate(null)).toBe(false)
    expect(showsPrettyIdPlate(undefined)).toBe(false)
  })
})
