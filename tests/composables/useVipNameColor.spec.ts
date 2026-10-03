import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockBootstrapStore,
} from '../helpers/nuxtMocks'
import { useVipNameColor } from '~/composables/vip/useVipNameColor'
import { VIP_GLINT_MIN_CHROMA, VIP_GLINT_MIN_LIGHTNESS } from '~/constants/vip'
import { glintColour } from '~/utils/vip-glint'

const glint = (hex: string): string => glintColour(hex, VIP_GLINT_MIN_LIGHTNESS, VIP_GLINT_MIN_CHROMA)

describe('useVipNameColor', () => {
  beforeEach(() => {
    setupNuxtMocks({
      bootstrapStore: createMockBootstrapStore({
        vipColorByLevel: new Map<number, string>([
          [1, '#1b4c57'],
          [2, '#5a441a'],
          [3, '#6b3293'],
          [4, '#00bc6f'],
        ]),
      }),
    })
  })

  afterEach(() => cleanupNuxtMocks())

  it('returns empty (no glint) for undefined, null and 0', () => {
    const { vipNameColor } = useVipNameColor()
    expect(vipNameColor(undefined)).toBe('')
    expect(vipNameColor(null)).toBe('')
    expect(vipNameColor(0)).toBe('')
  })

  it('returns the bootstrap colour made glint-vivid, including levels 1 and 2', () => {
    const { vipNameColor } = useVipNameColor()
    expect(vipNameColor(1)).toBe(glint('#1b4c57'))
    expect(vipNameColor(2)).toBe(glint('#5a441a'))
    expect(vipNameColor(3)).toBe(glint('#6b3293'))
    // The near-black backend picks really do change.
    expect(vipNameColor(1)).not.toBe('#1b4c57')
  })

  it('passes a colour already past both floors through unchanged', () => {
    const { vipNameColor } = useVipNameColor()
    expect(vipNameColor(4)).toBe('#00bc6f')
  })

  it('returns empty for a level the backend catalogue does not list', () => {
    const { vipNameColor } = useVipNameColor()
    expect(vipNameColor(99)).toBe('')
  })
})
