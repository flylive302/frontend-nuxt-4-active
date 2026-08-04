import type { ThreadMessage } from '~/types/inbox'
import { describe, expect, it } from 'vitest'
import { resolveMediaPayload, resolveVoicePayload } from '~/utils/dm-message-payload'

function message(overrides: Partial<ThreadMessage> & Pick<ThreadMessage, 'kind'>): ThreadMessage {
  return {
    id: '1',
    threadId: '1',
    senderId: '2',
    type: overrides.kind,
    content: '',
    sentAt: '2026-08-05T00:00:00Z',
    readAt: null,
    unsent: false,
    isOwn: false,
    ...overrides,
  } as ThreadMessage
}

describe('resolveMediaPayload', () => {
  it('prefers the structured media key the server sends', () => {
    const payload = { url: 'https://cdn/a.jpg', mimeType: 'image/jpeg', width: 1024, height: 1536 }

    expect(resolveMediaPayload(message({ kind: 'media', content: '📷 Photo', media: payload }))).toEqual(payload)
  })

  it('falls back to a payload inlined in content (legacy wire format)', () => {
    // This is what production serves today, with INBOX_MEDIA_PAYLOAD_IN_CONTENT on.
    const result = resolveMediaPayload(message({
      kind: 'media',
      content: '{"url":"https://cdn/a.jpg","mimeType":"image/jpeg","width":1024,"height":1536}',
    }))

    expect(result).toEqual({ url: 'https://cdn/a.jpg', mimeType: 'image/jpeg', width: 1024, height: 1536 })
  })

  it('returns null when content holds the safe label and no structured payload arrived', () => {
    // The flag-off wire format reaching a build that cannot read `media` — the
    // bubble shows its "update your app" placeholder instead of raw text.
    expect(resolveMediaPayload(message({ kind: 'media', content: '📷 Photo' }))).toBeNull()
  })

  it('returns null for a malformed payload rather than a partial one', () => {
    expect(resolveMediaPayload(message({ kind: 'media', content: 'not json at all' }))).toBeNull()
    expect(resolveMediaPayload(message({ kind: 'media', content: '{"mimeType":"image/jpeg"}' }))).toBeNull()
  })

  it('never resolves an unsent photo, so its URL cannot leak', () => {
    expect(resolveMediaPayload(message({
      kind: 'media',
      content: '',
      unsent: true,
      media: { url: 'https://cdn/secret.jpg', mimeType: 'image/jpeg' },
    }))).toBeNull()
  })

  it('uses the local preview while the upload is still in flight', () => {
    const result = resolveMediaPayload(message({
      kind: 'media',
      content: '',
      localPreviewUrl: 'blob:local-preview',
    }))

    expect(result).toEqual({ url: 'blob:local-preview', mimeType: 'image/jpeg' })
  })

  it('ignores non-media messages', () => {
    expect(resolveMediaPayload(message({ kind: 'text', content: 'hello' }))).toBeNull()
  })
})

describe('resolveVoicePayload', () => {
  it('prefers the structured voice key the server sends', () => {
    const payload = { url: 'https://cdn/a.webm', durationMs: 4200 }

    expect(resolveVoicePayload(message({ kind: 'voice', content: '🎤 Voice message', voice: payload }))).toEqual(payload)
  })

  it('falls back to a payload inlined in content (legacy wire format)', () => {
    const result = resolveVoicePayload(message({
      kind: 'voice',
      content: '{"url":"https://cdn/a.webm","durationMs":4200}',
    }))

    expect(result).toEqual({ url: 'https://cdn/a.webm', durationMs: 4200 })
  })

  it('returns null for a malformed payload', () => {
    expect(resolveVoicePayload(message({ kind: 'voice', content: '{"url":"https://cdn/a.webm"}' }))).toBeNull()
  })

  it('never resolves an unsent voice note', () => {
    expect(resolveVoicePayload(message({
      kind: 'voice',
      content: '',
      unsent: true,
      voice: { url: 'https://cdn/secret.webm', durationMs: 1000 },
    }))).toBeNull()
  })
})
