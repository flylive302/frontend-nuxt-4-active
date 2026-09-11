import { describe, it, expect } from 'vitest'
import {
  NOTIFICATION_TYPE_CONFIG,
  NOTIFICATION_TINT_CLASS,
  NOTIFICATION_ICON_CLASS,
} from '../../app/types/notification/notification'

/**
 * Tailwind v4 only emits classes it finds as literal source text. These maps
 * exist so every notification colour has a literal class; this guards the map
 * against a config colour that has no entry (or an empty one).
 */
describe('notification class maps', () => {
  const colours = new Set(Object.values(NOTIFICATION_TYPE_CONFIG).map((c) => c.color))

  it('tint map has a literal class for every colour the config uses', () => {
    for (const colour of colours) {
      expect(NOTIFICATION_TINT_CLASS[colour]).toMatch(/^bg-[a-z]+(\/15)?$/)
    }
  })

  it('icon map has a literal class for every colour the config uses', () => {
    for (const colour of colours) {
      expect(NOTIFICATION_ICON_CLASS[colour]).toMatch(/^text-[a-z]+$/)
    }
  })

  it('maps never interpolate (no template placeholders)', () => {
    for (const v of [...Object.values(NOTIFICATION_TINT_CLASS), ...Object.values(NOTIFICATION_ICON_CLASS)]) {
      expect(v).not.toContain('${')
    }
  })
})
