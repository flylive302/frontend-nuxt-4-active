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

/**
 * Per-tap view of a merged `gift:batch` item.
 *
 * MSAB's room ticker (`roomTicker.enqueueGift`) SUMS `quantity` across the
 * taps it merges and counts them in `count`, so on the wire `quantity` is the
 * item's TOTAL. Every consumer (seat value, chat quantity, lucky tap band,
 * playback) works in per-tap quantity × taps — multiplying the wire total by
 * `count` again inflated every non-sender's seat total and room XP by the
 * merge factor. Taps merged inside one ~100 ms tick share a quantity in
 * practice, which keeps the lucky split floor per tap (as the sender and the
 * backend book it). If the total does not divide evenly, the item is valued
 * as ONE tap of the total rather than guessing a split.
 */
export function batchItemTaps(totalQuantity: number, count: number): { quantity: number; taps: number } {
  if (count > 1 && totalQuantity % count === 0) {
    return { quantity: totalQuantity / count, taps: count };
  }
  return { quantity: totalQuantity, taps: 1 };
}
