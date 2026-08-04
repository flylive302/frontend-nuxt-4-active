// ========================================
// DM Message Preview (dm-messenger-v2)
// ========================================
// Kind-aware one-line preview for thread lists — media/voice payloads are
// JSON in `content`, so raw content must never be shown for them. Mirrors
// the backend's DmMessage::getPreviewContent() so realtime bumps and REST
// refetches render identical previews. Unknown kinds (newer server than
// this OTA bundle) degrade to a neutral label, matching the bubble's
// stale-OTA placeholder strategy.

import type { ThreadMessage } from '~/types/inbox'
import { resolveMediaPayload, resolveVoicePayload } from '~/utils/dm-message-payload'

export function dmMessagePreview(kind: string, content: string): string {
  if (kind === 'media') return '📷 Photo'
  if (kind === 'voice') return '🎤 Voice message'
  if (kind === 'text') return content
  return 'New message'
}

/**
 * What a "Copy" action should put on the clipboard for a message, or null
 * when there is nothing copyable (unsent, empty, unresolvable payload,
 * unknown kind). Text copies the text; media/voice copy the asset URL.
 *
 * Takes the whole message, not `content`: the asset URL lives in the
 * structured `media`/`voice` key, and `content` is only a fallback there.
 */
export function dmMessageCopyText(message: ThreadMessage): string | null {
  if (message.unsent) return null
  if (message.kind === 'text') return message.content || null

  const url = resolveMediaPayload(message)?.url ?? resolveVoicePayload(message)?.url

  return url !== undefined && url.length > 0 ? url : null
}
