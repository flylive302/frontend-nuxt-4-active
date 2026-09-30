/**
 * Gift value helpers (pure functions — no Vue reactivity, no store imports).
 */

import { LUCKY_SPLIT_SHARE, GIFT_VALUE_FLOAT_EPSILON } from '~/constants/room';
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
 * Coins to add to a seated user's 🪙 "gifts received" total (and room XP) for a
 * gift send.
 *
 * Mirrors the backend split: a LUCKY gift surfaces only the split base
 * (`LUCKY_SPLIT_SHARE` of its coin value) — never the full GCV. All other
 * categories credit the full GCV.
 *
 * The lucky value is deliberately NOT floored here. The backend floors once per
 * flush group (`GiftBatchProcessor::aggregate` folds ~0.5 s of one sender's taps,
 * then `GiftDistribution` floors `price × Σquantity × split%`), so flooring per
 * tap under-counted a 15-coin lucky combo by a third (1 vs ~1.5 per tap). Sum
 * the exact value and floor only for display — see `wholeGiftValue`.
 */
export function seatGiftValue(gift: Pick<Gift, 'category' | 'price'>, quantity: number): number {
  const gcv = gift.price * quantity;

  if (isLuckyCategory(gift.category)) {
    return gcv * LUCKY_SPLIT_SHARE;
  }

  return gcv;
}

/**
 * Whole value to show for an accumulated gift total (seat total, room XP):
 * rounded DOWN like the backend, never up (a single 15-coin lucky tap shows 1,
 * not 2). The epsilon absorbs float drift so a sum that should be 13 never
 * shows 12.
 */
export function wholeGiftValue(total: number): number {
  return Math.floor(total + GIFT_VALUE_FLOAT_EPSILON);
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
 * practice. If the total does not divide evenly, the item is treated as ONE
 * tap of the total rather than guessing a split (the seat value is the same
 * either way — only the chat/playback/lucky-band tap counts differ).
 */
export function batchItemTaps(totalQuantity: number, count: number): { quantity: number; taps: number } {
  if (count > 1 && totalQuantity % count === 0) {
    return { quantity: totalQuantity / count, taps: count };
  }
  return { quantity: totalQuantity, taps: 1 };
}
