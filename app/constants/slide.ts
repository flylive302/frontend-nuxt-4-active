// ========================================
// Slide overlay constants
// ========================================
// Static values for the unified slide overlay. Back-pressure tunables (TTL,
// per-band depth, concurrency caps, coalesce window) arrive with the SlideQueue
// in slice 2; slice 1 only needs the text-canvas rendering constants.

/** Canvas size for a text placeholder rendered into a slide's SVGA. */
export const SLIDE_TEXT_CANVAS_WIDTH = 300
export const SLIDE_TEXT_CANVAS_HEIGHT = 100

/** Font family/weight used when drawing slide text onto the canvas. */
export const SLIDE_TEXT_FONT_FAMILY = 'Inter, sans-serif'
export const SLIDE_TEXT_FONT_WEIGHT = 'bold'

/** Auto-fit bounds: shrink from max toward min, then wrap onto extra lines. */
export const SLIDE_TEXT_MAX_FONT_SIZE = 32
export const SLIDE_TEXT_MIN_FONT_SIZE = 22
export const SLIDE_TEXT_MAX_LINES = 2
export const SLIDE_TEXT_LINE_HEIGHT = 1
export const SLIDE_TEXT_PADDING_X = 16
