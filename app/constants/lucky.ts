// ========================================
// Lucky Draw Constants
// ========================================

export const LUCKY_DRAW_STORAGE_PREFIX = 'lucky_odds_ack_'

export const LUCKY_DRAW_COPY = {
  descriptionPart1: 'Every lucky gift you send enters one random draw per gift sent. The draw uses the base gift price (not affected by quantity or number of recipients). It either wins a coin prize of ',
  baseMultiplier: '2× the base gift price or more',
  descriptionPart2: ', or wins nothing — most draws win nothing.\n\nPrizes are paid from a shared prize pool funded by lucky gifts; the biggest multipliers only become available while the pool is large enough to pay them, and some have daily win limits. Spending virtual coins does not guarantee any particular outcome. No real-world currency or prizes are involved.',

  checkbox: 'I understand that Lucky Draw prizes are virtual and have no real-world monetary value.',
}

// ========================================
// Cashback float SVGA
// ========================================
// Every winning multiplier renders as an SVGA animation (one file per prize
// tier) instead of plain HTML text. ×0 (bust) renders nothing at all.

/** One .svga per prize tier: `<base>/<tier>.svga` (mirrors LuckyPrizeTierSeeder). */
export const LUCKY_CASHBACK_SVGA_BASE_URL = 'https://assets.flyliveapp.com/lucky/cashback'

/** Tiers that have an authored .svga file, ascending. */
export const LUCKY_CASHBACK_SVGA_TIERS = [2, 5, 10, 25, 50, 100, 250, 500, 750, 1000] as const

/** SVGA placeholder keys authored into every cashback file. */
export const LUCKY_CASHBACK_LABEL_KEY = 'test-a'
export const LUCKY_CASHBACK_COINS_KEY = 'test-b'

/** Rendered height of a cashback float, in px. */
export const LUCKY_CASHBACK_SVGA_HEIGHT_PX = 150

// ----------------------------------------
// Cashback text placeholders
// ----------------------------------------
// Dedicated to the cashback SVGA — deliberately NOT the slide overlay's
// SLIDE_TEXT_* values. Tune these freely; slides are unaffected.

/** Canvas size for a cashback text placeholder (must match the authored layer). */
export const LUCKY_CASHBACK_TEXT_CANVAS_WIDTH = 130
export const LUCKY_CASHBACK_TEXT_CANVAS_HEIGHT = 100

/** Font used when drawing cashback text onto the canvas. */
export const LUCKY_CASHBACK_TEXT_FONT_FAMILY = 'Inter, sans-serif'
export const LUCKY_CASHBACK_TEXT_FONT_WEIGHT = 'bold'
export const LUCKY_CASHBACK_TEXT_COLOR = '#ffffff'

/** Static label drawn into the `test-a` placeholder (the .svga carries the number). */
export const LUCKY_CASHBACK_LABEL_TEXT = 'Gets'

/** Label font size, in px. Fixed — the text never changes, so it never shrinks. */
export const LUCKY_CASHBACK_LABEL_FONT_SIZE = 42

/**
 * Coin amount font size, in px. The value varies in length (3 → 7 digits), so
 * it starts at MAX and auto-shrinks toward MIN until it fits the canvas width.
 */
export const LUCKY_CASHBACK_COINS_FONT_SIZE = 80
export const LUCKY_CASHBACK_COINS_MIN_FONT_SIZE = 32
export const LUCKY_CASHBACK_TEXT_MAX_LINES = 1
export const LUCKY_CASHBACK_TEXT_LINE_HEIGHT = 1
export const LUCKY_CASHBACK_TEXT_PADDING_X = 0

// ----------------------------------------
// Cashback float placement
// ----------------------------------------

/**
 * Horizontal lanes (percent of the float container) a burst of wins cycles
 * through. Ordered far-left → far-right → inner pairs → centre so consecutive
 * floaters land as far apart as possible and rarely overlap. Each floater is
 * centred on its lane.
 */
export const LUCKY_FLOAT_LANES_PCT = [16, 84, 38, 66, 50] as const
