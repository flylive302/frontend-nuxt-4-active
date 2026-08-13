// ========================================
// Avatar Frame Constants
// ========================================

import type { FrameDisplayConfig } from '~/types/user/bootstrap'

/**
 * Fallback overlay geometry, used when a prop carries no authored config —
 * a frame not yet backfilled, or a legacy row the server could not parse.
 * Mirrors `FrameDisplayConfig` defaults in the backend value object.
 */
export const DEFAULT_FRAME_DISPLAY: FrameDisplayConfig = {
  scale: 110,
  padding: 16,
  top: '0%',
  left: '0%',
}

/** Padding applied to the avatar box when no frame is equipped. */
export const NO_FRAME_PADDING = '16%'

// ----------------------------------------
// Dynamic text baked into a frame's SVGA
// ----------------------------------------

/**
 * Text canvases are sized to the SVGA sprite's own slot at render time — the
 * lib draws dynamic elements unscaled, so a mismatched canvas is clipped out
 * of view. Only the styling is fixed here.
 */
export const FRAME_TEXT_COLOR = '#ffffff'
export const FRAME_TEXT_FONT_FAMILY = 'Inter, sans-serif'
export const FRAME_TEXT_FONT_WEIGHT = 'bold'

/**
 * Auto-fit bounds. A frame banner is a single line — usernames shrink to fit
 * rather than wrapping, which would overflow the baked artwork.
 */
export const FRAME_TEXT_MAX_FONT_SIZE = 28
export const FRAME_TEXT_MIN_FONT_SIZE = 12
export const FRAME_TEXT_MAX_LINES = 1
export const FRAME_TEXT_LINE_HEIGHT = 1
export const FRAME_TEXT_PADDING_X = 10
