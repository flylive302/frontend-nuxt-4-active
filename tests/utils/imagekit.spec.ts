import { describe, it, expect } from 'vitest'
import { avatarImageSrc, giftThumbnailSrc, levelBadgeSrc, withImageKitTransform } from '../../app/utils/imagekit'

// ========================================
// Fixtures
// ========================================

const IK_AVATAR_URL = 'https://ik.imagekit.io/flylive/avatars/user-123.webp'
const IK_AVATAR_URL_WITH_TR = 'https://ik.imagekit.io/flylive/avatars/user-123.webp?tr=w-128,q-75,c-maintain_ratio,f-auto'
const NON_IK_URL = 'https://cdn.example.com/avatars/user-123.webp'

// ========================================
// Tests
// ========================================

describe('avatarImageSrc', () => {
  it('appends the shared 256px resize transform to an ImageKit URL', () => {
    const result = avatarImageSrc(IK_AVATAR_URL)
    const params = new URL(result).searchParams
    expect(params.get('tr')).toBe('w-256,q-75,c-maintain_ratio,f-auto')
  })

  it('passes non-ImageKit URLs through unchanged', () => {
    expect(avatarImageSrc(NON_IK_URL)).toBe(NON_IK_URL)
  })

  it('leaves an ImageKit URL that already carries a tr param untouched', () => {
    expect(avatarImageSrc(IK_AVATAR_URL_WITH_TR)).toBe(IK_AVATAR_URL_WITH_TR)
  })

  it('returns an empty string for null/undefined input', () => {
    expect(avatarImageSrc(null)).toBe('')
    expect(avatarImageSrc(undefined)).toBe('')
  })

  it('honors an explicit width escape hatch for oversized surfaces (e.g. profile header)', () => {
    const result = avatarImageSrc(IK_AVATAR_URL, { w: 512, q: 80 })
    const params = new URL(result).searchParams
    expect(params.get('tr')).toBe('w-512,q-80,c-maintain_ratio,f-auto')
  })
})

describe('withImageKitTransform (shared helper, sanity-checked via giftThumbnailSrc)', () => {
  it('resizes ImageKit URLs', () => {
    const params = new URL(giftThumbnailSrc(IK_AVATAR_URL)).searchParams
    expect(params.get('tr')).toBe('w-256,q-75,c-maintain_ratio,f-auto')
  })

  it('is a no-op for malformed URLs', () => {
    expect(withImageKitTransform('not-a-url', { w: 100 })).toBe('not-a-url')
  })

  it('emits an h- transform for height-constrained surfaces', () => {
    const params = new URL(withImageKitTransform(IK_AVATAR_URL, { h: 40 })).searchParams
    expect(params.get('tr')).toBe('h-40,q-75,c-maintain_ratio,f-auto')
  })

  it('emits w- before h- when both are supplied', () => {
    const params = new URL(withImageKitTransform(IK_AVATAR_URL, { w: 100, h: 40 })).searchParams
    expect(params.get('tr')).toBe('w-100,h-40,q-75,c-maintain_ratio,f-auto')
  })

  // Guards the cache key: `w-…,q-…,c-maintain_ratio,f-auto` is the exact string already
  // baked into ~/constants/assets and cached at the CDN edge. Reordering forks every entry.
  it('keeps the width-only param order byte-identical to the constants in assets.ts', () => {
    const params = new URL(withImageKitTransform(IK_AVATAR_URL, { w: 256 })).searchParams
    expect(params.get('tr')).toBe('w-256,q-75,c-maintain_ratio,f-auto')
  })

  it('is a no-op when neither dimension is supplied, rather than emitting a dimensionless tr', () => {
    expect(withImageKitTransform(IK_AVATAR_URL, {})).toBe(IK_AVATAR_URL)
  })
})

describe('levelBadgeSrc', () => {
  // Level badges are wide (wealth 512x158 = aspect 3.24, charm 374x136 = 2.75) but are laid
  // out by CSS height (`h-5`, `h-7`). Sizing them by width under-serves the wide ones: an
  // `h-5` wealth badge paints ~65 CSS px across, so `w-48` would upscale and look blurry.
  it('applies the 2.5x DPR factor and constrains by height, not width', () => {
    const params = new URL(levelBadgeSrc(IK_AVATAR_URL, 20)).searchParams
    expect(params.get('tr')).toBe('h-50,q-75,c-maintain_ratio,f-auto')
  })

  it('scales with the rendered height and always rounds up to a whole pixel', () => {
    expect(new URL(levelBadgeSrc(IK_AVATAR_URL, 16)).searchParams.get('tr')).toBe('h-40,q-75,c-maintain_ratio,f-auto')
    expect(new URL(levelBadgeSrc(IK_AVATAR_URL, 28)).searchParams.get('tr')).toBe('h-70,q-75,c-maintain_ratio,f-auto')
  })

  it('never emits a w- param, so badge aspect ratio cannot distort the fetched variant', () => {
    expect(levelBadgeSrc(IK_AVATAR_URL, 20)).not.toContain('w-')
  })

  it('returns an empty string for a missing badge', () => {
    expect(levelBadgeSrc(null, 20)).toBe('')
    expect(levelBadgeSrc(undefined, 20)).toBe('')
  })
})
