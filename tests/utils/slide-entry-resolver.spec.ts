import { describe, it, expect } from 'vitest'

import { resolveEntrySlide } from '../../app/utils/slide-entry-resolver'
import type { EntrySlideConfig, EntrySlideContext } from '../../app/types/slide'

function config(overrides: Partial<EntrySlideConfig> = {}): EntrySlideConfig {
  return {
    id: 7,
    source_kind: 'entry',
    svga_url: 'https://cdn.example/entry.svga',
    default_top_px: 400,
    height_px: 56,
    scope: 'room',
    link_type: 'none',
    priority: 0,
    placeholder_schema: {
      test: { role: 'text', template: 'entry_default' },
    },
    text_templates: [{ name: 'entry_default', message: '{user} is the room' }],
    ...overrides,
  }
}

const ctx: EntrySlideContext = {
  userId: 42,
  userName: 'Ada',
  userAvatar: 'https://cdn.example/ada.png',
  roomName: 'Lounge',
}

describe('resolveEntrySlide', () => {
  it('returns null when there is no bound slide config', () => {
    expect(resolveEntrySlide(null, ctx)).toBeNull()
    expect(resolveEntrySlide(undefined, ctx)).toBeNull()
  })

  it('interpolates the entry text template with the {user} variable', () => {
    const payload = resolveEntrySlide(config(), ctx)
    expect(payload?.texts.test).toBe('Ada is the room')
  })

  it('maps layout/scope/priority and links to the joining user', () => {
    const payload = resolveEntrySlide(config({ link_type: 'track' }), ctx)
    expect(payload).toMatchObject({
      slideId: 7,
      svgaUrl: 'https://cdn.example/entry.svga',
      top: 400,
      height: 56,
      scope: 'room',
      priority: 0,
      link: { type: 'track', userId: 42 },
    })
  })

  it('resolves the user_avatar role to the joining user avatar', () => {
    const payload = resolveEntrySlide(
      config({ placeholder_schema: { face: { role: 'user_avatar' } } }),
      ctx,
    )
    expect(payload?.replaceElements.face).toBe('https://cdn.example/ada.png')
  })

  it('omits an avatar image when the user has none (baked layer shows through)', () => {
    const payload = resolveEntrySlide(
      config({ placeholder_schema: { face: { role: 'user_avatar' } } }),
      { ...ctx, userAvatar: null },
    )
    expect(payload?.replaceElements.face).toBeUndefined()
  })

  it('resolves a static role from the slide-uploaded image url', () => {
    const payload = resolveEntrySlide(
      config({ placeholder_schema: { badge: { role: 'static', static_url: 'https://cdn.example/s.png' } } }),
      ctx,
    )
    expect(payload?.replaceElements.badge).toBe('https://cdn.example/s.png')
  })

  it('falls back to empty text for an unknown template, never throwing', () => {
    const payload = resolveEntrySlide(
      config({ placeholder_schema: { test: { role: 'text', template: 'missing' } } }),
      ctx,
    )
    expect(payload?.texts.test).toBe('')
  })

  it('collapses unknown {tokens} in a template to empty string', () => {
    const payload = resolveEntrySlide(
      config({ text_templates: [{ name: 'entry_default', message: '{user} → {mystery}' }] }),
      ctx,
    )
    expect(payload?.texts.test).toBe('Ada → ')
  })
})
