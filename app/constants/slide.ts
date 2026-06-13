// ========================================
// Slide overlay constants
// ========================================
// Static values for the unified slide overlay. Back-pressure tunables (TTL,
// per-band depth, concurrency caps, coalesce window) arrive with the SlideQueue
// in slice 2; slice 1 only needs the text-canvas rendering constants.

/** Canvas size for a text placeholder rendered into a slide's SVGA. */
export const SLIDE_TEXT_CANVAS_WIDTH = 400
export const SLIDE_TEXT_CANVAS_HEIGHT = 80

/** Font used when drawing slide text onto the canvas. */
export const SLIDE_TEXT_FONT = 'bold 32px Inter, sans-serif'
