import { describe, expect, it } from 'vitest'
import {
  CP_BIND_FX_AVATAR_WIDTH,
  CP_BIND_FX_GIFT_ID,
  CP_BIND_FX_LEFT_AVATAR_KEY,
  CP_BIND_FX_LEFT_NAME_KEY,
  CP_BIND_FX_RIGHT_AVATAR_KEY,
  CP_BIND_FX_RIGHT_NAME_KEY,
  CP_BIND_FX_SVGA,
} from '~/constants/cp-event'
import { avatarImageSrc } from '~/utils/imagekit'
import { cpBindFxFills, cpBindFxGift, cpCoupleKey, newlySeatedCouples } from '~/utils/cp-bind-fx'

describe('cpCoupleKey', () => {
  it('is order independent', () => {
    expect(cpCoupleKey({ leftUserId: 7, rightUserId: 10 })).toBe(cpCoupleKey({ leftUserId: 10, rightUserId: 7 }))
  })

  it('differs for different couples', () => {
    expect(cpCoupleKey({ leftUserId: 7, rightUserId: 10 })).not.toBe(cpCoupleKey({ leftUserId: 7, rightUserId: 11 }))
  })
})

describe('newlySeatedCouples', () => {
  const a = { leftUserId: 1, rightUserId: 2 }
  const b = { leftUserId: 3, rightUserId: 4 }

  it('returns all couples for an empty previous set', () => {
    expect(newlySeatedCouples(new Set(), [a, b])).toEqual([a, b])
  })

  it('returns only couples not already known', () => {
    expect(newlySeatedCouples(new Set([cpCoupleKey(a)]), [a, b])).toEqual([b])
  })

  it('treats a swapped-sides couple as not new', () => {
    const swapped = { leftUserId: 2, rightUserId: 1 }
    expect(newlySeatedCouples(new Set([cpCoupleKey(a)]), [swapped])).toEqual([])
  })
})

describe('cpBindFxGift', () => {
  it('is a critical svga gift pointing at the bind asset', () => {
    const gift = cpBindFxGift()
    expect(gift.is_critical).toBe(true)
    expect(gift.asset_type).toBe('svga')
    expect(gift.animation_url).toBe(CP_BIND_FX_SVGA)
    expect(gift.id).toBe(CP_BIND_FX_GIFT_ID)
  })
})

describe('cpBindFxFills', () => {
  const left = { name: 'Lia', avatar: 'https://cdn.example.com/l.jpg' }
  const right = { name: 'Ravi', avatar: 'https://cdn.example.com/r.jpg' }

  it('maps left to slot 01 and right to slot 02', () => {
    const fills = cpBindFxFills(left, right)
    expect(fills.images).toEqual({
      [CP_BIND_FX_LEFT_AVATAR_KEY]: avatarImageSrc(left.avatar, { w: CP_BIND_FX_AVATAR_WIDTH }),
      [CP_BIND_FX_RIGHT_AVATAR_KEY]: avatarImageSrc(right.avatar, { w: CP_BIND_FX_AVATAR_WIDTH }),
    })
    expect(fills.texts).toEqual({
      [CP_BIND_FX_LEFT_NAME_KEY]: 'Lia',
      [CP_BIND_FX_RIGHT_NAME_KEY]: 'Ravi',
    })
    expect(CP_BIND_FX_LEFT_AVATAR_KEY).toBe('avatar01')
    expect(CP_BIND_FX_RIGHT_NAME_KEY).toBe('username02')
  })

  it('omits keys for a missing user', () => {
    const fills = cpBindFxFills(undefined, right)
    expect(Object.keys(fills.images ?? {})).toEqual([CP_BIND_FX_RIGHT_AVATAR_KEY])
    expect(Object.keys(fills.texts ?? {})).toEqual([CP_BIND_FX_RIGHT_NAME_KEY])
  })

  it('omits keys for a missing avatar or name', () => {
    const fills = cpBindFxFills({ name: 'Lia', avatar: null }, { name: '', avatar: 'https://cdn.example.com/r.jpg' })
    expect(Object.keys(fills.images ?? {})).toEqual([CP_BIND_FX_RIGHT_AVATAR_KEY])
    expect(Object.keys(fills.texts ?? {})).toEqual([CP_BIND_FX_LEFT_NAME_KEY])
  })
})
