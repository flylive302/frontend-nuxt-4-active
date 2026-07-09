/**
 * Seat Reaction Constants (ADR 0015 / seat-reactions)
 */
import { REACTION_ASSET_BASE } from './assets';

/**
 * Minimum time a Seat Reaction's animation must remain visible, in
 * milliseconds. Short Lotties loop until this threshold, then finish their
 * current loop; Lotties whose intrinsic duration already meets/exceeds this
 * play exactly once. See `planReactionPlayback`.
 */
export const REACTION_MIN_DISPLAY_MS = 3_000;

/** Number of columns in the Reaction Drawer thumbnail grid. */
export const REACTION_GRID_COLUMNS = 4;

/** Estimated pixel height of one grid row, for virtual-scroller sizing. */
export const REACTION_GRID_ROW_MIN_SIZE_PX = 84;

/** Estimated pixel height of a sticky category section header. */
export const REACTION_SECTION_HEADER_MIN_SIZE_PX = 36;

/** Minimum characters typed before search filtering kicks in. */
export const REACTION_SEARCH_MIN_CHARS = 1;

/**
 * Build the Lottie animation URL for a reaction code, from the ImageKit
 * mirror (ADR 0015 / slice 02). Fallback to the Google Noto hotlink is a
 * one-line change if ImageKit ever needs to be bypassed:
 * `https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/lottie.json`
 */
export function getReactionLottieUrl(code: string): string {
  return `${REACTION_ASSET_BASE}/${code}/lottie.json`;
}

/** Build the static WebP thumbnail URL for a reaction code (drawer grid). */
export function getReactionThumbnailUrl(code: string): string {
  return `${REACTION_ASSET_BASE}/${code}/512.webp`;
}
