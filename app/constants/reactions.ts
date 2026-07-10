/**
 * Seat Reaction Constants (ADR 0015 / seat-reactions)
 */
import { REACTION_ASSET_BASE, REACTION_ASSET_FALLBACK_BASE } from './assets';

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

/**
 * Build the static thumbnail URL for a reaction code (drawer grid).
 *
 * `emoji.svg` — NOT `512.webp`. Noto's 512.webp is an *animated* WebP
 * (~370KB, and no CDN transform can strip its frames), so using it here made
 * the grid decode and play hundreds of animations while scrolling.
 */
export function getReactionThumbnailUrl(code: string): string {
  return `${REACTION_ASSET_BASE}/${code}/emoji.svg`;
}

/**
 * Google Noto hotlink for a thumbnail — the fallback the card retries once
 * with if the ImageKit mirror 404s (i.e. `reactions-mirror.mjs --upload` has
 * not yet mirrored `emoji.svg`, or ImageKit refuses SVG delivery). Keeps the
 * drawer usable rather than blank if assets and bundle deploy out of order.
 */
export function getReactionThumbnailFallbackUrl(code: string): string {
  return `${REACTION_ASSET_FALLBACK_BASE}/${code}/emoji.svg`;
}
