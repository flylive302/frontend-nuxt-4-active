import { describe, expect, it } from 'vitest'
import {
  defaultFxForTier,
  nextFxMutePreference,
  normalizeFxMutePreference,
  resolveFxEnabled,
  resolveFxMuted,
} from '../../app/utils/fx-tier-defaults'

// cost-and-speed-tuning/14 — weak phones: gift/entry muted + no view transitions by default.

describe('defaultFxForTier', () => {
  it.each(['low', 'mid', 'unknown'] as const)('%s -> everything off', (tier) => {
    expect(defaultFxForTier(tier)).toEqual({
      giftAnimations: false,
      entryAnimations: false,
      viewTransitions: false,
    })
  })

  it('high -> everything on (current behaviour)', () => {
    expect(defaultFxForTier('high')).toEqual({
      giftAnimations: true,
      entryAnimations: true,
      viewTransitions: true,
    })
  })
})

describe('resolveFxMuted (mute axis)', () => {
  it('auto follows the tier default', () => {
    expect(resolveFxMuted('auto', false)).toBe(true)
    expect(resolveFxMuted('auto', true)).toBe(false)
  })

  it('on mutes on any tier', () => {
    expect(resolveFxMuted('on', true)).toBe(true)
    expect(resolveFxMuted('on', false)).toBe(true)
  })

  it('off plays on any tier', () => {
    expect(resolveFxMuted('off', true)).toBe(false)
    expect(resolveFxMuted('off', false)).toBe(false)
  })
})

describe('resolveFxEnabled', () => {
  it('user override wins both ways; auto defers to the tier', () => {
    expect(resolveFxEnabled('on', false)).toBe(true)
    expect(resolveFxEnabled('off', true)).toBe(false)
    expect(resolveFxEnabled('auto', true)).toBe(true)
    expect(resolveFxEnabled('auto', false)).toBe(false)
  })
})

describe('normalizeFxMutePreference (persisted-shape migration)', () => {
  it('legacy boolean: false -> auto, true -> on', () => {
    expect(normalizeFxMutePreference(false)).toBe('auto')
    expect(normalizeFxMutePreference(true)).toBe('on')
  })

  it('keeps valid tri-state values', () => {
    expect(normalizeFxMutePreference('auto')).toBe('auto')
    expect(normalizeFxMutePreference('on')).toBe('on')
    expect(normalizeFxMutePreference('off')).toBe('off')
  })

  it.each([undefined, null, 'garbage', 1, {}])('corrupt %s -> auto', (v) => {
    expect(normalizeFxMutePreference(v)).toBe('auto')
  })
})

describe('nextFxMutePreference', () => {
  it('cycles auto -> on -> off -> auto', () => {
    expect(nextFxMutePreference('auto')).toBe('on')
    expect(nextFxMutePreference('on')).toBe('off')
    expect(nextFxMutePreference('off')).toBe('auto')
  })
})
