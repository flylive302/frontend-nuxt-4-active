import { describe, expect, it } from 'vitest'
import { classifyDeviceClass } from '../../app/utils/device-class'
import {
  defaultFrameAnimationCap,
  isAnimatedAvatarFramesPreference,
  resolveFrameAnimationCap,
} from '../../app/utils/frame-animation-tier'
import { FRAME_ANIMATION_BUDGET } from '../../app/constants/room'

// ============================================================
// android-client-performance/16, ADR 0039 — seat avatar frames still by
// default on ≤4GB phones
//
// Measured 2026-09-23 on an Oppo A6x (SD685, 4GB): five always-on SVGA seat
// loops alone kept the main thread ~89% busy at ~5fps. Only `high`-tier
// devices animate by default; the user switch overrides the tier both ways.
// ============================================================

describe('defaultFrameAnimationCap', () => {
  it.each([
    ['low', 0],
    ['mid', 0],
    ['high', FRAME_ANIMATION_BUDGET],
    ['unknown', 0],
  ] as const)('tier %s defaults to cap %s', (deviceClass, expectedCap) => {
    expect(defaultFrameAnimationCap(deviceClass)).toBe(expectedCap)
  })
})

describe('resolveFrameAnimationCap', () => {
  const tiers = ['low', 'mid', 'high', 'unknown'] as const

  it.each(tiers)('preference "on" animates at the full budget on tier %s', (deviceClass) => {
    expect(resolveFrameAnimationCap('on', deviceClass)).toBe(FRAME_ANIMATION_BUDGET)
  })

  it.each(tiers)('preference "off" is 0 on tier %s', (deviceClass) => {
    expect(resolveFrameAnimationCap('off', deviceClass)).toBe(0)
  })

  it.each([
    ['low', 0],
    ['mid', 0],
    ['high', FRAME_ANIMATION_BUDGET],
    ['unknown', 0],
  ] as const)('preference "auto" falls back to the tier default on %s (%s)', (deviceClass, expectedCap) => {
    expect(resolveFrameAnimationCap('auto', deviceClass)).toBe(expectedCap)
  })
})

describe('isAnimatedAvatarFramesPreference', () => {
  it.each(['auto', 'on', 'off'])('accepts %s', (value) => {
    expect(isAnimatedAvatarFramesPreference(value)).toBe(true)
  })

  it.each([undefined, null, '', 'ON', 'high', 42, {}])('rejects %s', (value) => {
    expect(isAnimatedAvatarFramesPreference(value)).toBe(false)
  })
})

describe('device memory → animation cap, end to end', () => {
  it('a 4GB device (mid tier) resolves to cap 0 under auto', () => {
    const deviceClass = classifyDeviceClass({ deviceMemory: 4 })
    expect(deviceClass).toBe('mid')
    expect(resolveFrameAnimationCap('auto', deviceClass)).toBe(0)
  })

  it('a 6-core, no-memory device (mid tier) resolves to cap 0 under auto', () => {
    const deviceClass = classifyDeviceClass({ hardwareConcurrency: 6 })
    expect(deviceClass).toBe('mid')
    expect(resolveFrameAnimationCap('auto', deviceClass)).toBe(0)
  })

  it('an 8GB device (high tier) resolves to FRAME_ANIMATION_BUDGET under auto', () => {
    const deviceClass = classifyDeviceClass({ deviceMemory: 8 })
    expect(deviceClass).toBe('high')
    expect(resolveFrameAnimationCap('auto', deviceClass)).toBe(FRAME_ANIMATION_BUDGET)
  })
})
