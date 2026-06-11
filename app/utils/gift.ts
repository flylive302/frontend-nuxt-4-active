/**
 * Gift value helpers (pure functions — no Vue reactivity, no store imports).
 */

import { LUCKY_RECEIVER_SHARE } from '~/constants/room';
import type { Gift } from '~/types/gift/gift';

/**
 * Coins to add to a seated user's 🪙 "gifts received" total for a gift send.
 *
 * Mirrors the backend receiver split: a LUCKY gift only credits the receiver
 * `LUCKY_RECEIVER_SHARE` of its coin value (GCV), so the seat total must add the
 * floored receiver share — never the full GCV. All other categories credit the
 * full GCV. (Room XP is separate and always uses full GCV.)
 */
export function seatGiftValue(gift: Pick<Gift, 'category' | 'price'>, quantity: number): number {
  const gcv = gift.price * quantity;

  if (gift.category === 'lucky') {
    return Math.floor(gcv * LUCKY_RECEIVER_SHARE);
  }

  return gcv;
}
