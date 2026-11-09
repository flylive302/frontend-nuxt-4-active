// ========================================
// resolveVideoStartCollapsed Tests (room-video-player 09)
// ========================================
import { describe, expect, it } from 'vitest'
import { resolveVideoStartCollapsed } from '~/utils/video-start-collapsed'
import type { DeviceClass } from '~/utils/device-class'

describe('resolveVideoStartCollapsed', () => {
  it.each<[DeviceClass, boolean]>([
    ['low', true],
    ['unknown', true],
    ['mid', false],
    ['high', false],
  ])('tier %s with the preference off starts collapsed = %s', (tier, expected) => {
    expect(resolveVideoStartCollapsed(tier, false)).toBe(expected)
  })

  it.each<DeviceClass>(['low', 'unknown', 'mid', 'high'])(
    'the "always start collapsed" preference wins on tier %s',
    (tier) => {
      expect(resolveVideoStartCollapsed(tier, true)).toBe(true)
    },
  )
})
