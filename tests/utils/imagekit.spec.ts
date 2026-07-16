import { describe, it, expect } from 'vitest'
import { avatarImageSrc, giftThumbnailSrc, withImageKitTransform } from '../../app/utils/imagekit'

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
})
