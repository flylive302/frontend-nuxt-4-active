// ========================================
// Entry slide resolver — pure
// ========================================
// Client-side mirror of the backend SlideResolver for the trivial *entry*
// vocabulary (`user`, `room`). Gift/lucky slides are resolved server-side and
// pushed over `slide:play`; entry banners are resolved here from the Slide
// config that rides along in the prop manifest (ADR 0009 — client-side entry
// resolution). Pure: no Vue, no store, no socket. Missing vars/roles fall back
// safely (empty text, omitted image) and never throw — matching SlideResolver.

import type {
  EntrySlideConfig,
  EntrySlideContext,
  SlidePlayPayload,
} from '~/types/slide'

/** Entry role vocabulary (kept in sync with the backend entry kind). */
const ROLE_TEXT = 'text'
const ROLE_STATIC = 'static'
const ROLE_USER_AVATAR = 'user_avatar'

/** Replace `{token}` occurrences; unknown tokens collapse to '' (never throws). */
function interpolate(message: string, variables: Record<string, string>): string {
  return message.replace(/\{(\w+)\}/g, (_, key: string) => variables[key] ?? '')
}

/**
 * Resolve an equipped `slides` prop's entry Slide into a render-ready
 * {@link SlidePlayPayload} for the joining user. Returns null when the prop
 * carries no bound slide config (caller skips — no banner).
 */
export function resolveEntrySlide(
  config: EntrySlideConfig | null | undefined,
  context: EntrySlideContext,
): SlidePlayPayload | null {
  if (!config) return null

  const variables: Record<string, string> = {
    user: context.userName,
    room: context.roomName,
  }

  const replaceElements: Record<string, string> = {}
  const texts: Record<string, string> = {}

  for (const [svgaKey, spec] of Object.entries(config.placeholder_schema ?? {})) {
    if (spec.role === ROLE_TEXT) {
      const template = spec.template
        ? (config.text_templates ?? []).find((t) => t.name === spec.template)?.message ?? ''
        : ''
      texts[svgaKey] = interpolate(template, variables)
      continue
    }

    const url = resolveUrl(spec.role, spec.static_url, context.userAvatar)
    // Omit absent/empty URLs — the baked SVGA layer shows through.
    if (url) replaceElements[svgaKey] = url
  }

  return {
    slideId: config.id,
    svgaUrl: config.svga_url,
    top: config.default_top_px,
    height: config.height_px,
    scope: config.scope,
    priority: config.priority,
    replaceElements,
    texts,
    link: { type: config.link_type, userId: context.userId },
  }
}

/** Resolve a non-text role to a URL: static from the slide, user_avatar from context. */
function resolveUrl(role: string, staticUrl: string | null | undefined, userAvatar: string | null): string | null {
  if (role === ROLE_STATIC) return staticUrl ?? null
  if (role === ROLE_USER_AVATAR) return userAvatar
  return null
}
