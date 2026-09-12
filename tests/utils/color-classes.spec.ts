import { describe, it, expect } from 'vitest'
import { COLOR_TEXT_CLASS, COLOR_BORDER_CLASS, COLOR_BG_10_CLASS } from '../../app/utils/color-classes'

/** Guards the literal-class maps: every entry must be a plain literal with no interpolation. */
describe('color class maps', () => {
  it.each([
    ['text', COLOR_TEXT_CLASS, /^text-[a-z]+$/],
    ['border', COLOR_BORDER_CLASS, /^border-[a-z]+$/],
    ['bg/10', COLOR_BG_10_CLASS, /^bg-[a-z]+\/10$/],
  ] as const)('%s map holds only literal classes', (_name, map, pattern) => {
    for (const cls of Object.values(map)) {
      expect(cls).toMatch(pattern)
      expect(cls).not.toContain('${')
    }
  })
})
