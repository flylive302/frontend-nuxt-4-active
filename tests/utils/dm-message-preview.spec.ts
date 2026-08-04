import type { ThreadMessage } from '~/types/inbox'
import { describe, expect, it } from 'vitest'
import { dmMessageCopyText, dmMessagePreview } from '~/utils/dm-message-preview'

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

describe('dmMessagePreview', () => {
  it('returns text content as-is', () => {
    expect(dmMessagePreview('text', 'hello there')).toBe('hello there')
  })

  it('labels media messages instead of exposing the JSON payload', () => {
    expect(dmMessagePreview('media', '{"url":"https://x/y.jpg","mimeType":"image/jpeg"}')).toBe('📷 Photo')
  })

  it('labels voice messages instead of exposing the JSON payload', () => {
    expect(dmMessagePreview('voice', '{"url":"https://x/y.webm","durationMs":1200}')).toBe('🎤 Voice message')
  })

  it('degrades unknown future kinds to a neutral label (stale OTA)', () => {
    expect(dmMessagePreview('sticker', '{"id":9}')).toBe('New message')
  })
})

describe('dmMessageCopyText', () => {
  it('copies text content verbatim', () => {
    expect(dmMessageCopyText(message({ kind: 'text', content: 'hello there' }))).toBe('hello there')
  })

  it('copies the asset URL from the structured payload', () => {
    expect(dmMessageCopyText(message({
      kind: 'media',
      content: '📷 Photo',
      media: { url: 'https://x/y.jpg', mimeType: 'image/jpeg' },
    }))).toBe('https://x/y.jpg')

    expect(dmMessageCopyText(message({
      kind: 'voice',
      content: '🎤 Voice message',
      voice: { url: 'https://x/y.webm', durationMs: 1200 },
    }))).toBe('https://x/y.webm')
  })

  it('falls back to the asset URL inlined in content (legacy wire format)', () => {
    expect(dmMessageCopyText(message({
      kind: 'media',
      content: '{"url":"https://x/y.jpg","mimeType":"image/jpeg"}',
    }))).toBe('https://x/y.jpg')
  })

  it('returns null when there is nothing copyable', () => {
    expect(dmMessageCopyText(message({ kind: 'text', content: 'gone', unsent: true }))).toBeNull()
    expect(dmMessageCopyText(message({ kind: 'text', content: '' }))).toBeNull()
    expect(dmMessageCopyText(message({ kind: 'media', content: 'not-json' }))).toBeNull()
    expect(dmMessageCopyText(message({ kind: 'media', content: '{"mimeType":"image/jpeg"}' }))).toBeNull()
    expect(dmMessageCopyText(message({ kind: 'sticker' as 'text', content: '{"id":9}' }))).toBeNull()
  })

  it('never exposes the URL of an unsent photo', () => {
    expect(dmMessageCopyText(message({
      kind: 'media',
      content: '',
      unsent: true,
      media: { url: 'https://x/secret.jpg', mimeType: 'image/jpeg' },
    }))).toBeNull()
  })
})
