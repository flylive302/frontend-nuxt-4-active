// ========================================
// Message Seen Status (Read Receipts)
// ========================================
// Pure derivation of the delivered-vs-seen tick state for own messages
// (dm-realtime-platform/08). Seen = the peer's thread-level watermark has
// reached this message id; falls back to the per-message readAt signal when
// no watermark is known yet (e.g. before the first thread fetch/reconcile).

/**
 * Whether an own message should render the "seen" (double-tick) state.
 */
export function isMessageSeen(
  messageId: string | number,
  peerSeenUpToMessageId: string | number | null,
  readAt: string | null,
): boolean {
  if (peerSeenUpToMessageId !== null) {
    return Number(messageId) <= Number(peerSeenUpToMessageId)
  }

  return readAt !== null
}
