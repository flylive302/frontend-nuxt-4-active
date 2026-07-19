import { describe, expect, it } from 'vitest'
import { dmMessageCopyText, dmMessagePreview } from '~/utils/dm-message-preview'

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
    expect(dmMessageCopyText('text', 'hello there', false)).toBe('hello there')
  })

  it('copies the asset URL for media and voice messages', () => {
    expect(dmMessageCopyText('media', '{"url":"https://x/y.jpg","mimeType":"image/jpeg"}', false)).toBe('https://x/y.jpg')
    expect(dmMessageCopyText('voice', '{"url":"https://x/y.webm","durationMs":1200}', false)).toBe('https://x/y.webm')
  })

  it('returns null when there is nothing copyable', () => {
    expect(dmMessageCopyText('text', 'gone', true)).toBeNull() // unsent
    expect(dmMessageCopyText('text', '', false)).toBeNull() // empty
    expect(dmMessageCopyText('media', 'not-json', false)).toBeNull() // unparseable
    expect(dmMessageCopyText('media', '{"mimeType":"image/jpeg"}', false)).toBeNull() // no url
    expect(dmMessageCopyText('sticker', '{"id":9}', false)).toBeNull() // unknown kind
  })
})
