import { describe, it, expect } from 'vitest'
import { ASSETS, vipBadgeUIImg } from '../../app/constants/assets'

// ========================================
// vipBadgeUIImg — extension split
// ========================================

/**
 * These assertions exist to stop someone "simplifying" the ternary in `vipBadgeUIImg`.
 *
 * The two extensions are NOT interchangeable on the CDN — verified 2026-07-30, every level
 * publishes exactly one and the other returns 404:
 *
 *   levels 1-2 → badge.webp (badge.png 404s)
 *   levels 3+  → badge.png  (badge.webp 404s)
 *
 * Three components previously hardcoded `.png`, so every VIP 1-2 user rendered a broken
 * badge on every chat message — a contributor to the 4.16% CDN error rate.
 */
describe('vipBadgeUIImg', () => {
  it('uses .webp for levels 1-2, where .png does not exist', () => {
    expect(vipBadgeUIImg(1)).toBe('https://ik.imagekit.io/flylive/vip/1/badge.webp')
    expect(vipBadgeUIImg(2)).toBe('https://ik.imagekit.io/flylive/vip/2/badge.webp')
  })

  it('uses .png from level 3 up, where .webp does not exist', () => {
    expect(vipBadgeUIImg(3)).toBe('https://ik.imagekit.io/flylive/vip/3/badge.png')
    expect(vipBadgeUIImg(15)).toBe('https://ik.imagekit.io/flylive/vip/15/badge.png')
  })

  it('switches extension exactly at the 2/3 boundary', () => {
    expect(vipBadgeUIImg(2)).toContain('.webp')
    expect(vipBadgeUIImg(3)).toContain('.png')
  })

  it('returns an empty string for a user with no VIP level', () => {
    expect(vipBadgeUIImg(null)).toBe('')
    expect(vipBadgeUIImg(undefined)).toBe('')
    expect(vipBadgeUIImg(0)).toBe('')
  })
})

// ========================================
// Transform coverage on static constants
// ========================================

/**
 * The CDN bandwidth incident (2026-07-30) was caused by static art served with no `tr=` at
 * all — 84% of requests, ~96% of bytes. These guards stop a new untransformed constant
 * being added back without a deliberate opt-out.
 */
describe('ASSETS transform coverage', () => {
  /** Base-only by design: callers size these per layout via `withImageKitTransform`. */
  const INTENTIONALLY_UNTRANSFORMED = new Set<string>([
    'ROOM_BG_PLACEHOLDER',
    // `tr` does not apply to video delivery; tracked for R2 migration instead.
    'MALL_BG_VIDEO',
    // Level badges span ~16 CSS px (chat row) to ~240 CSS px (`w-7/12` on the profile page).
    // A baked width shipped at w-48 and was reviewed as visibly blurry on profile. No single
    // width serves both ends — each call site sizes these itself.
    'DEFAULT_WEALTH_BADGE',
    'DEFAULT_CHARM_BADGE',
    'DEFAULT_WEALTH_LEVEL_BADGE',
    'DEFAULT_CHARM_LEVEL_BADGE',
  ])

  const imageKitEntries = Object.entries(ASSETS).filter(
    ([, url]) => typeof url === 'string' && url.includes('ik.imagekit.io'),
  )

  it('covers a meaningful number of ImageKit constants', () => {
    expect(imageKitEntries.length).toBeGreaterThan(10)
  })

  it.each(imageKitEntries)('%s carries a tr= transform', (key, url) => {
    if (INTENTIONALLY_UNTRANSFORMED.has(key)) {
      expect(url).not.toContain('tr=')
      return
    }
    expect(url).toContain('tr=')
  })

  it('never emits a double tr= (the room-card bug that silently dropped the override)', () => {
    for (const [, url] of imageKitEntries) {
      expect(url.split('tr=').length - 1).toBeLessThanOrEqual(1)
    }
  })

  it('keeps the two coin-icon variants distinct and correctly ordered', () => {
    // Same source file, two deliberate variants — small for icons, large for reward heroes.
    expect(ASSETS.COIN_ICON).toContain('w-96')
    expect(ASSETS.COIN_ICON_LARGE).toContain('w-192')
    expect(ASSETS.ROOM_CARD_TOP).toBe(ASSETS.COIN_ICON)
  })

  it('keeps the music-player GIF on f-auto so it is delivered as animated WebP', () => {
    // Source is a 1300x1300 12-frame GIF: 6.55 MB raw, 943 KB even to a WebP-capable client.
    // Dropping f-auto here silently restores a multi-megabyte fetch inside every room.
    expect(ASSETS.MUSIC_PLAYER).toContain('f-auto')
    expect(ASSETS.MUSIC_PLAYER).toContain('w-112')
  })
})
