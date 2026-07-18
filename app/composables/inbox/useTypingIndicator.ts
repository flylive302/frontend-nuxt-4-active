// ========================================
// Typing Indicator Composable
// ========================================
// Manages typing indicator state for the active thread.
//
// dm-realtime-platform/04: transport migrated from a Reverb client whisper
// to an ephemeral MSAB socket relay (client→MSAB→peer only, no backend
// persistence). Public API (`isOtherTyping`, `sendTyping`, `listenForTyping`,
// `stopListening`) is unchanged so call sites (thread-panel.vue) need no
// changes.
//
// MSAB scopes delivery to the peer's socket(s) that currently have this
// thread open (a `dm:thread.opened`/`dm:thread.closed` per-socket room
// membership), so this composable emits those alongside listen/stop-listen.

import { TYPING_EMIT_THROTTLE_MS, TYPING_INDICATOR_TIMEOUT_MS } from '~/constants/inbox'
import { useAudioSocket } from '../room/useAudioSocket'

interface DmTypingPayload {
  threadId: string
  userId: number
}

export function useTypingIndicator() {
  const { socket } = useAudioSocket()
  const store = useInboxStore()

  const isOtherTyping = ref(false)
  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  let lastEmitAt = 0
  let currentListenThreadId: string | null = null
  let onTyping: ((payload: DmTypingPayload) => void) | null = null

  // ── GATE ──────────────────────────────────────────────
  function validateSend(threadId: string | null): string | null {
    if (!socket.value?.connected) return 'not-connected'
    if (!threadId) return 'no-active-thread'
    const peerUserId = store.threadById(threadId)?.participant.id
    if (peerUserId === undefined || peerUserId === null) return 'no-peer'
    if (Date.now() - lastEmitAt < TYPING_EMIT_THROTTLE_MS) return 'throttled'
    return null
  }

  // ── EXECUTE ───────────────────────────────────────────
  /**
   * Emit a typing signal to the other participant. Throttled to match the
   * MSAB rate limit (TYPING_EMIT_THROTTLE_MS).
   */
  function sendTyping(): void {
    const threadId = store.activeThreadId
    const gateError = validateSend(threadId)
    if (gateError) return

    const peerUserId = Number(store.threadById(threadId!)!.participant.id)
    lastEmitAt = Date.now()
    socket.value!.emit('dm:typing', { threadId, peerUserId })
  }

  /**
   * Mark this thread as open on MSAB (scopes typing relay delivery) and
   * start listening for the peer's typing signals.
   */
  function listenForTyping(threadId: string): void {
    if (!socket.value) return

    currentListenThreadId = threadId
    socket.value.emit('dm:thread.opened', { threadId })

    onTyping = (payload: DmTypingPayload) => {
      if (payload.threadId !== currentListenThreadId) return
      // The relay has no participant auth (unlike the old Echo private
      // channel) — only trust signals from this thread's actual peer.
      const peerId = currentListenThreadId ? store.threadById(currentListenThreadId)?.participant.id : undefined
      if (peerId === undefined || Number(peerId) !== payload.userId) return
      isOtherTyping.value = true

      // REACT: auto-dismiss after a timeout of inactivity
      if (typingTimeout) clearTimeout(typingTimeout)
      typingTimeout = setTimeout(() => {
        isOtherTyping.value = false
      }, TYPING_INDICATOR_TIMEOUT_MS)
    }
    socket.value.on('dm:typing', onTyping)
  }

  function stopListening(threadId: string): void {
    isOtherTyping.value = false
    if (typingTimeout) clearTimeout(typingTimeout)
    typingTimeout = null

    if (socket.value && onTyping) {
      socket.value.off('dm:typing', onTyping)
    }
    onTyping = null
    currentListenThreadId = null

    socket.value?.emit('dm:thread.closed', { threadId })
  }

  return {
    isOtherTyping: readonly(isOtherTyping),
    sendTyping,
    listenForTyping,
    stopListening,
  }
}
