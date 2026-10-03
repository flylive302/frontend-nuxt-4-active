// ========================================
// VIP Constants
// ========================================
// Tuning for the VIP name glint (`<VipName>` / `<MarqueeName>`, CSS in
// `assets/css/main.css` § VIP display name).

/**
 * Minimum OKLCH lightness for the glint colour. Several backend
 * `vip_levels.color` values are near-black (L ≈ 0.3), which vanish on the dark
 * UI. 0.65 is bright enough to read on black yet dark enough to stand out
 * against the white name text the band sweeps over.
 */
export const VIP_GLINT_MIN_LIGHTNESS = 0.65

/**
 * Minimum OKLCH chroma (saturation) for the glint colour. Lifting a dark,
 * dull pick only in lightness turns it greyish — near-white, so the band is
 * barely visible over white text. 0.16 makes every level vivid.
 */
export const VIP_GLINT_MIN_CHROMA = 0.16

/** One full glint cycle (sweep + rest). The sweep itself is the first 50% (see keyframes). */
export const VIP_GLINT_PERIOD_MS = 3000
