import { describe, it, expect } from 'vitest'
import { COLORS_TO_NUXT_UI, type ExtendedColors, type NuxtUIColor } from '../../app/types/colors'

describe('COLORS_TO_NUXT_UI mapping', () => {
  it('should map all Colors values correctly', () => {
    expect(COLORS_TO_NUXT_UI.primary).toBe('pink')
    expect(COLORS_TO_NUXT_UI.secondary).toBe('purple')
    expect(COLORS_TO_NUXT_UI.tertiary).toBe('amber')
    expect(COLORS_TO_NUXT_UI.success).toBe('emerald')
    expect(COLORS_TO_NUXT_UI.info).toBe('sky')
    expect(COLORS_TO_NUXT_UI.warning).toBe('yellow')
    expect(COLORS_TO_NUXT_UI.error).toBe('red')
  })

  it('should map ExtendedColors including neutral', () => {
    // Verify all standard colors
    expect(COLORS_TO_NUXT_UI.primary).toBe('pink')
    expect(COLORS_TO_NUXT_UI.secondary).toBe('purple')
    expect(COLORS_TO_NUXT_UI.tertiary).toBe('amber')
    expect(COLORS_TO_NUXT_UI.success).toBe('emerald')
    expect(COLORS_TO_NUXT_UI.info).toBe('sky')
    expect(COLORS_TO_NUXT_UI.warning).toBe('yellow')
    expect(COLORS_TO_NUXT_UI.error).toBe('red')
    
    // Verify neutral is mapped
    expect(COLORS_TO_NUXT_UI.neutral).toBe('neutral')
  })

  it('should return valid NuxtUIColor values', () => {
    const extendedColors: ExtendedColors[] = ['primary', 'secondary', 'tertiary', 'success', 'info', 'warning', 'error', 'neutral']
    const validNuxtUIColors: NuxtUIColor[] = ['pink', 'purple', 'amber', 'emerald', 'sky', 'yellow', 'red', 'neutral']
    
    extendedColors.forEach(color => {
      const mapped = COLORS_TO_NUXT_UI[color]
      expect(validNuxtUIColors).toContain(mapped)
      expect(mapped).toBeDefined()
      expect(typeof mapped).toBe('string')
    })
  })

  it('should not return undefined for any ExtendedColors value', () => {
    const extendedColors: ExtendedColors[] = ['primary', 'secondary', 'tertiary', 'success', 'info', 'warning', 'error', 'neutral']
    
    extendedColors.forEach(color => {
      expect(COLORS_TO_NUXT_UI[color]).toBeDefined()
      expect(COLORS_TO_NUXT_UI[color]).not.toBeUndefined()
    })
  })

  it('should match app.config.ts color mappings', () => {
    // This test documents the expected mappings from app.config.ts
    expect(COLORS_TO_NUXT_UI.primary).toBe('pink')
    expect(COLORS_TO_NUXT_UI.secondary).toBe('purple')
    expect(COLORS_TO_NUXT_UI.tertiary).toBe('amber')
    expect(COLORS_TO_NUXT_UI.info).toBe('sky')
    expect(COLORS_TO_NUXT_UI.success).toBe('emerald')
    expect(COLORS_TO_NUXT_UI.warning).toBe('yellow')
    expect(COLORS_TO_NUXT_UI.error).toBe('red')
    expect(COLORS_TO_NUXT_UI.neutral).toBe('neutral')
  })
})

