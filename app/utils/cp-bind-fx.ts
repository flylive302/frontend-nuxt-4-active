/**
 * CP bind FX — pure helpers (no Vue, no stores) for the full-screen animation
 * that plays to the whole room when two CP partners become seat neighbours.
 */
import type { Gift, SvgaFills } from '~/types/gift/gift'
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

/** Two CP partners in neighbouring seats, left seat first. */
export interface CpSeatedCouple {
  readonly leftUserId: number
  readonly rightUserId: number
}

/** The two partners as shown in the animation. */
export interface CpBindFxUser {
  readonly name?: string | null
  readonly avatar?: string | null
}

/** Seat-order independent: the same two users are the same couple whichever side each sits. */
export function cpCoupleKey(couple: CpSeatedCouple): string {
  const low = Math.min(couple.leftUserId, couple.rightUserId)
  const high = Math.max(couple.leftUserId, couple.rightUserId)
  return `${low}:${high}`
}

/** Couples in `next` that were not adjacent before (`previousKeys`) — they just sat together. */
export function newlySeatedCouples(
  previousKeys: ReadonlySet<string>,
  next: readonly CpSeatedCouple[],
): CpSeatedCouple[] {
  return next.filter((couple) => !previousKeys.has(cpCoupleKey(couple)))
}

/**
 * Synthetic gift that carries the bind SVGA through the gift playback queue.
 * Critical, so it plays full screen in the center lane and is never shed.
 */
export function cpBindFxGift(): Gift {
  return {
    id: CP_BIND_FX_GIFT_ID,
    name: 'CP',
    label: null,
    description: null,
    price: 0,
    thumbnail_url: '',
    animation_url: CP_BIND_FX_SVGA,
    asset_type: 'svga',
    category: 'cp-gift',
    rarity: 'common',
    sort_order: 0,
    is_critical: true,
  }
}

/** Avatars + names for the SVGA slots; a missing user keeps that side's baked layer. */
export function cpBindFxFills(left: CpBindFxUser | undefined, right: CpBindFxUser | undefined): SvgaFills {
  const images: Record<string, string> = {}
  const texts: Record<string, string> = {}

  if (left?.avatar) images[CP_BIND_FX_LEFT_AVATAR_KEY] = avatarImageSrc(left.avatar, { w: CP_BIND_FX_AVATAR_WIDTH })
  if (right?.avatar) images[CP_BIND_FX_RIGHT_AVATAR_KEY] = avatarImageSrc(right.avatar, { w: CP_BIND_FX_AVATAR_WIDTH })
  if (left?.name) texts[CP_BIND_FX_LEFT_NAME_KEY] = left.name
  if (right?.name) texts[CP_BIND_FX_RIGHT_NAME_KEY] = right.name

  return { images, texts }
}
