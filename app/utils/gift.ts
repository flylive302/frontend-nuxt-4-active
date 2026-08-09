/**
 * Gift value helpers (pure functions — no Vue reactivity, no store imports).
 */

import { LUCKY_SPLIT_SHARE } from '~/constants/room';
import type { Gift } from '~/types/gift/gift';

/**
 * True for any gift category that follows lucky-gift logic (split payout,
 * combo mode, lucky float, etc). `gild-lucky` is a lucky variant treated
 * identically to `lucky` everywhere — centralize the check here so new
 * lucky-like categories only need to be added in one place.
 */
export function isLuckyCategory(category: string | undefined | null): boolean {
  return category === 'lucky' || category === 'gild-lucky';
}

/**
 * Coins to add to a seated user's 🪙 "gifts received" total for a gift send.
 *
 * Mirrors the backend split: a LUCKY gift surfaces only the split base
 * (`LUCKY_SPLIT_SHARE` of its coin value), so the seat total adds the floored
 * split base — never the full GCV. All other categories credit the full GCV.
 * (Room XP is separate.)
 */
export function seatGiftValue(gift: Pick<Gift, 'category' | 'price'>, quantity: number): number {
  const gcv = gift.price * quantity;

  if (isLuckyCategory(gift.category)) {
    return Math.floor(gcv * LUCKY_SPLIT_SHARE);
  }

  return gcv;
}
