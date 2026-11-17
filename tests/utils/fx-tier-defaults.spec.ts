import { describe, expect, it } from 'vitest'
import {
  defaultFxForTier,
  nextFxMutePreference,
  normalizeFxEnablePreference,
  normalizeFxMutePreference,
  resolveFxEnabled,
  resolveFxMuted,
} from '../../app/utils/fx-tier-defaults'

// cost-and-speed-tuning/14 — weak phones: gift/entry muted + no view transitions by default.

describe('defaultFxForTier', () => {
  it('low -> everything off', () => {
    expect(defaultFxForTier('low')).toEqual({
      giftAnimations: false,
      entryAnimations: false,
      viewTransitions: false,
      nameMotion: false,
    })
  })

  it.each(['mid', 'unknown'] as const)(
    '%s -> gifts/entries/transitions on (current behaviour), name motion still',
    (tier) => {
      expect(defaultFxForTier(tier)).toEqual({
        giftAnimations: true,
        entryAnimations: true,
        viewTransitions: true,
        nameMotion: false,
      })
    },
  )

  it('high -> everything on, including name motion', () => {
    expect(defaultFxForTier('high')).toEqual({
      giftAnimations: true,
      entryAnimations: true,
      viewTransitions: true,
      nameMotion: true,
    })
  })

  // android-client-performance/17 fix 3: same cut as animated seat frames
  // (frame-animation-tier.ts) — only `high` animates names by default.
  it.each([
    ['low', false],
    ['mid', false],
    ['unknown', false],
    ['high', true],
  ] as const)('nameMotion on %s = %s', (tier, expected) => {
    expect(defaultFxForTier(tier).nameMotion).toBe(expected)
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

describe('normalizeFxEnablePreference (enable axis)', () => {
  it('keeps valid tri-state values', () => {
    expect(normalizeFxEnablePreference('auto')).toBe('auto')
    expect(normalizeFxEnablePreference('on')).toBe('on')
    expect(normalizeFxEnablePreference('off')).toBe('off')
  })

  it.each([undefined, null, 'garbage', true, false, 1, {}])('corrupt %s -> auto', (v) => {
    expect(normalizeFxEnablePreference(v)).toBe('auto')
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
