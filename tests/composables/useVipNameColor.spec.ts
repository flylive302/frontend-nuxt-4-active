import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockBootstrapStore,
} from '../helpers/nuxtMocks'
import { useVipNameColor } from '~/composables/vip/useVipNameColor'

describe('useVipNameColor', () => {
  beforeEach(() => {
    setupNuxtMocks({
      bootstrapStore: createMockBootstrapStore({
        vipColorByLevel: new Map<number, string>([
          [1, '#1b4c57'],
          [2, '#5a441a'],
          [3, '#6b3293'],
        ]),
      }),
    })
  })

  afterEach(() => cleanupNuxtMocks())

  it('returns empty (inherit) for undefined, null and 0', () => {
    const { vipNameColor } = useVipNameColor()
    expect(vipNameColor(undefined)).toBe('')
    expect(vipNameColor(null)).toBe('')
    expect(vipNameColor(0)).toBe('')
  })

  it('returns the bootstrap colour for known levels, including 1 and 2', () => {
    const { vipNameColor } = useVipNameColor()
    expect(vipNameColor(1)).toBe('#1b4c57')
    expect(vipNameColor(2)).toBe('#5a441a')
    expect(vipNameColor(3)).toBe('#6b3293')
  })

  it('returns empty for a level the backend catalogue does not list', () => {
    const { vipNameColor } = useVipNameColor()
    expect(vipNameColor(99)).toBe('')
  })
})
