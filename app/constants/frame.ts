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
