/**
 * Gift value helpers (pure functions — no Vue reactivity, no store imports).
 */

import { LUCKY_SPLIT_SHARE } from '~/constants/room';
import type { Gift } from '~/types/gift/gift';

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

  if (gift.category === 'lucky') {
    return Math.floor(gcv * LUCKY_SPLIT_SHARE);
  }

  return gcv;
}
