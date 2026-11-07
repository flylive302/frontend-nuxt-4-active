/**
 * Gift value helpers (pure functions — no Vue reactivity, no store imports).
 */

import { CP_BINDING_SUBCATEGORY, CP_GIFT_CATEGORY } from '~/constants/cp-event';
import { LUCKY_SPLIT_SHARE, GIFT_VALUE_FLOAT_EPSILON } from '~/constants/room';
import { GIFT_SEND_ERROR, LUCKY_COMBO_PAUSING_REFUSAL_CODES } from '~/constants/gift';
import type { Gift } from '~/types/gift/gift';
import type { GiftSendAck } from '~/types/room/audio';

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
 * GATE (gift-cashback-latency 06): may the sender afford ONE more lucky tap,
 * counting the lucky taps already emitted but not yet acked?
 *
 * Under `ackBalance` the balance only drops when an ack/push lands, so the
 * raw balance still shows the coins that in-flight taps are about to spend.
 * `inFlightCost` is that not-yet-booked spend. Pure — it never writes
 * anything; the balance shown on screen is NOT netted (display-only rule).
 */
export function canAffordLuckyTap(spendable: number, inFlightCost: number, cost: number): boolean {
  return spendable - inFlightCost >= cost;
}

/**
 * True when a `gift:send` ack is a refusal that should pause the lucky combo
 * button: an ackBalance `code` from `LUCKY_COMBO_PAUSING_REFUSAL_CODES`, or the
 * rate limiter (`error: GIFT_SEND_ERROR.RATE_LIMITED`, no `code`). A missing
 * ack (timeout / disconnect) is not a refusal and never pauses.
 */
export function isComboPausingRefusal(
  ack: Pick<GiftSendAck, 'success' | 'code' | 'error'> | null,
): boolean {
  if (!ack || ack.success) return false;
  if (ack.code !== undefined && LUCKY_COMBO_PAUSING_REFUSAL_CODES.has(ack.code)) return true;
  return ack.error === GIFT_SEND_ERROR.RATE_LIMITED;
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

/**
 * True for the CP binding gift (category `cp-gift` + subcategory `binding`).
 */
export function isBindingGift(gift: Pick<Gift, 'category' | 'subcategory'>): boolean {
  return gift.category === CP_GIFT_CATEGORY && gift.subcategory === CP_BINDING_SUBCATEGORY;
}

/**
 * Drawer ordering inside one category tab: the binding gift first, then
 * price ascending, then sort_order.
 */
export function compareGiftsForDrawer(
  a: Pick<Gift, 'category' | 'subcategory' | 'price' | 'sort_order'>,
  b: Pick<Gift, 'category' | 'subcategory' | 'price' | 'sort_order'>
): number {
  const bindingRank = Number(isBindingGift(b)) - Number(isBindingGift(a));

  return bindingRank || a.price - b.price || a.sort_order - b.sort_order;
}
