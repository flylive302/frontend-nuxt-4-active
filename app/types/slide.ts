// ========================================
// Unified Slide Overlay — types
// ========================================
// Types only (no runtime code). The render-ready payload is resolved entirely
// server-side (SlideResolver) and shipped over the global `slide:play` socket
// event. See docs/adr/0009-unified-slide-overlay-system.md.

export type SlideScope = 'room' | 'app'
export type SlideLinkType = 'track' | 'profile' | 'none'

/** Where tapping the slide leads. `userId` is the trigger user (e.g. gift sender). */
export interface SlideLink {
  type: SlideLinkType
  userId: number | null
}

/** The wire shape emitted on `slide:play`. */
export interface SlidePlayPayload {
  slideId: number
  svgaUrl: string
  /** Vertical position of the banner, in px. */
  top: number
  /** Banding height, in px. */
  height: number
  scope: SlideScope
  priority: number
  /** SVGA key → image URL (avatars + images). */
  replaceElements: Record<string, string>
  /** SVGA key → resolved text string. */
  texts: Record<string, string>
  link: SlideLink
}

/** A payload promoted to an active, on-screen slide with a unique instance id. */
export interface ActiveSlide extends SlidePlayPayload {
  /** Unique per render so concurrent copies of the same slide key + remove cleanly. */
  instanceId: string
  /**
   * Combo count: how many coalesced sends this on-screen item represents (1 for
   * a lone slide). Stays on the same `instanceId` so the SVGA never remounts.
   */
  count: number
}
