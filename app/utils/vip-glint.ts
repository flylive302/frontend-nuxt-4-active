// ========================================
// VIP glint helpers (pure)
// ========================================
// Colour maths for the VIP name glint: the backend `vip_levels.color` values
// are picked freely in the admin panel and several are near-black, which is
// invisible as a sweep over white text on the dark UI. `glintColour` keeps
// each level's hue and raises its perceptual lightness (OKLCH L) and
// saturation (chroma) to floors, staying inside sRGB.

// ========================================
// Types
// ========================================

type Rgb = readonly [number, number, number]

interface Oklch {
  l: number
  c: number
  h: number
}

// ========================================
// Constants
// ========================================

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Binary-search steps when trimming chroma back into gamut (2^-16 precision). */
const CHROMA_SEARCH_STEPS = 16

/** Below this OKLCH chroma a colour counts as grey: no hue worth saturating. */
const GREY_CHROMA = 0.02

/** Float slack for the sRGB gamut test (OKLab round-trips are not exact). */
const GAMUT_EPSILON = 1e-4

// ========================================
// sRGB <-> OKLCH (Björn Ottosson's OKLab matrices)
// ========================================

function parseHex(hex: string): Rgb | null {
  const match = HEX_RE.exec(hex.trim())
  if (!match?.[1]) return null
  const digits = match[1].length === 3
    ? match[1].split('').map(d => d + d).join('')
    : match[1]
  const channel = (i: number): number => parseInt(digits.slice(i, i + 2), 16) / 255
  return [channel(0), channel(2), channel(4)]
}

function toHex(rgb: Rgb): string {
  return '#' + rgb
    .map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'))
    .join('')
}

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
}

function rgbToOklch([r, g, b]: Rgb): Oklch {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) }
}

/** Linear (unclamped) sRGB — components outside [0, 1] mean out of gamut. */
function oklchToLinearRgb({ l: L, c, h }: Oklch): Rgb {
  const A = c * Math.cos(h)
  const B = c * Math.sin(h)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function inGamut(rgb: Rgb): boolean {
  return rgb.every(v => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON)
}

// ========================================
// Public API
// ========================================

/**
 * Glint colour for a backend VIP colour: lightness raised to at least
 * `minLightness` (OKLCH L, 0–1) and chroma (saturation) raised to at least
 * `minChroma`, hue kept. Lifting lightness alone turns dark picks greyish and
 * close to white — invisible as a band over white text — so dull colours are
 * also saturated. Chroma is trimmed back to whatever sRGB can show at that
 * lightness. Greys (no hue) stay grey. Colours already past both floors are
 * returned unchanged (normalised to lowercase `#rrggbb`); unparseable input
 * is returned as-is.
 */
export function glintColour(hex: string, minLightness: number, minChroma: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const colour = rgbToOklch(rgb)
  const saturate = colour.c >= GREY_CHROMA && colour.c < minChroma
  if (colour.l >= minLightness && !saturate) return toHex(rgb)

  const target: Oklch = {
    h: colour.h,
    l: Math.max(colour.l, minLightness),
    c: saturate ? minChroma : colour.c,
  }
  let rgbOut = oklchToLinearRgb(target)
  if (!inGamut(rgbOut)) {
    // Largest chroma (≤ target) that still fits sRGB at this lightness.
    let lo = 0
    let hi = target.c
    for (let i = 0; i < CHROMA_SEARCH_STEPS; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToLinearRgb({ ...target, c: mid }))) lo = mid
      else hi = mid
    }
    rgbOut = oklchToLinearRgb({ ...target, c: lo })
  }
  return toHex([linearToSrgb(rgbOut[0]), linearToSrgb(rgbOut[1]), linearToSrgb(rgbOut[2])])
}

/**
 * Negative `animation-delay` (ms) that puts a freshly-mounted animation at the
 * same phase as one started at time 0 — every glint on screen sweeps in step,
 * whenever it mounted. `nowMs` is `performance.now()`, which shares its origin
 * with the document timeline CSS animations run on.
 */
export function glintPhaseDelayMs(nowMs: number, periodMs: number): number {
  if (periodMs <= 0) return 0
  return -(nowMs % periodMs)
}
