/**
 * Duck-level conversion — pure, so it can be unit-tested.
 *
 * The store keeps the talk-over duck target as a whole-number percent
 * (5–80, see `stores/audioPreferences.ts`); the playback engine wants a
 * 0–1 fraction. This is the one place that conversion happens.
 */
import {
  MIN_DUCK_LEVEL_PERCENT,
  MAX_DUCK_LEVEL_PERCENT,
} from '~/stores/audioPreferences';

/** Clamp `percent` to the store's allowed range, then convert to a 0–1 fraction. */
export function percentToFraction(percent: number): number {
  const clamped = Math.min(MAX_DUCK_LEVEL_PERCENT, Math.max(MIN_DUCK_LEVEL_PERCENT, percent));
  return clamped / 100;
}
