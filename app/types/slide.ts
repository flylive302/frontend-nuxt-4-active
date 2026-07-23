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

/**
 * Additive structured block present only on lucky-win slides (lucky-burst-draw
 * ticket 10). Its mere presence on a `slide:play` payload means the win
 * crossed the server-side slide-binding threshold — only slide-bound tiers
 * emit `slide:play` at all, so no client-side threshold check is needed.
 */
export interface SlideLuckyWinBlock {
  winnerId: number
  winnerName: string
  /** Raw float cashback multiplier, e.g. 20 or 0.5 — format before display. */
  multiplier: number
  coinsWon: number
  roomId: number
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
  /** Present only for lucky-win slides — absent on gift/entry slides. */
  lucky?: SlideLuckyWinBlock
}

// ========================================
// Entry slides — client-side resolution
// ========================================
// Entry banners (the equipped `slides` Prop) are NOT server-resolved+pushed like
// gift/lucky slides. Their vocabulary is trivial (`user`, `room`) and the client
// already holds both plus the prop catalog, so the linked Slide's authored config
// rides along in the prop manifest and the client resolves the payload locally on
// join (ADR 0009 — client-side entry resolution). This is the snake_case shape of
// the backend `SlideConfig::toArray()` embedded under `BootstrapProp.slide`.

/** One SVGA placeholder spec: a role plus its text-template / static-image hint. */
export interface SlidePlaceholderSpec {
  role: string
  template?: string | null
  static_url?: string | null
}

/** Authored Slide config embedded in a `slides`-type prop for client resolution. */
export interface EntrySlideConfig {
  id: number
  source_kind: string
  svga_url: string
  default_top_px: number
  height_px: number
  scope: SlideScope
  link_type: SlideLinkType
  priority: number
  /** svga_key → role spec (keyed map, mirrors the resolved server shape). */
  placeholder_schema: Record<string, SlidePlaceholderSpec>
  text_templates: { name: string; message: string }[]
}

/** The minimal trigger context an entry resolution needs: the joining user + room. */
export interface EntrySlideContext {
  userId: number
  userName: string
  userAvatar: string | null
  roomName: string
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
