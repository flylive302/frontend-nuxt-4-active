// ========================================
// DM Structured Payload Resolution (dm-messenger-v2)
// ========================================
// Media and voice messages carry a structured payload. The server sends it in
// its own `media` / `voice` key precisely so `content` can stay human-safe —
// any client that doesn't understand `kind` renders `content` verbatim, and a
// JSON blob there is what makes an old bundle print raw JSON in the bubble.
//
// The `content` parse below is the legacy fallback: it reads payloads from a
// backend that still inlines them (INBOX_MEDIA_PAYLOAD_IN_CONTENT=true). Once
// that flag is off everywhere, only the structured keys are ever populated and
// the fallback becomes dead weight — safe to delete then, not before.

import type { MediaContentPayload, ThreadMessage, VoiceContentPayload } from '~/types/inbox'

/**
 * The image payload to render, or null when there is nothing renderable.
 * Unsent messages resolve to null so a retracted photo never exposes its URL.
 */
export function resolveMediaPayload(message: ThreadMessage): MediaContentPayload | null {
  if (message.kind !== 'media' || message.unsent) return null

  // Optimistic bubble: the remote URL doesn't exist yet, show the local blob.
  if (message.localPreviewUrl) {
    return message.media ?? { url: message.localPreviewUrl, mimeType: 'image/jpeg' }
  }

  return message.media ?? parseLegacyContentPayload<MediaContentPayload>(
    message.content,
    parsed => typeof parsed.url === 'string' && typeof parsed.mimeType === 'string',
  )
}

/** The voice payload to render, or null when there is nothing playable. */
export function resolveVoicePayload(message: ThreadMessage): VoiceContentPayload | null {
  if (message.kind !== 'voice' || message.unsent) return null

  return message.voice ?? parseLegacyContentPayload<VoiceContentPayload>(
    message.content,
    parsed => typeof parsed.url === 'string' && typeof parsed.durationMs === 'number',
  )
}

/** Legacy fallback: decode a structured payload that arrived inside `content`. */
function parseLegacyContentPayload<T>(content: string, isValid: (parsed: Partial<T>) => boolean): T | null {
  try {
    const parsed = JSON.parse(content) as Partial<T>
    return isValid(parsed) ? (parsed as T) : null
  }
  catch {
    return null
  }
}
