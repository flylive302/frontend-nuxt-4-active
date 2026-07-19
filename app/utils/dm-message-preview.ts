// ========================================
// DM Message Preview (dm-messenger-v2)
// ========================================
// Kind-aware one-line preview for thread lists — media/voice payloads are
// JSON in `content`, so raw content must never be shown for them. Mirrors
// the backend's DmMessage::getPreviewContent() so realtime bumps and REST
// refetches render identical previews. Unknown kinds (newer server than
// this OTA bundle) degrade to a neutral label, matching the bubble's
// stale-OTA placeholder strategy.

export function dmMessagePreview(kind: string, content: string): string {
  if (kind === 'media') return '📷 Photo'
  if (kind === 'voice') return '🎤 Voice message'
  if (kind === 'text') return content
  return 'New message'
}

/**
 * What a "Copy" action should put on the clipboard for a message, or null
 * when there is nothing copyable (unsent, empty, unparseable payload,
 * unknown kind). Text copies the text; media/voice copy the asset URL.
 */
export function dmMessageCopyText(kind: string, content: string, unsent: boolean): string | null {
  if (unsent) return null
  if (kind === 'text') return content || null
  if (kind === 'media' || kind === 'voice') {
    try {
      const parsed = JSON.parse(content) as { url?: unknown }
      return typeof parsed.url === 'string' && parsed.url.length > 0 ? parsed.url : null
    }
    catch {
      return null
    }
  }
  return null
}
