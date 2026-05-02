// ========================================
// Inbox Real-Time Handler
// ========================================
// Subscribes to private-dm.{userId} and wires Reverb events → store.
// Call subscribe() after login; unsubscribe() on logout.

import { createLogger } from '~/utils/logger'
import type { Thread, ThreadMessage } from '~/types/inbox'

const log = createLogger('[useInboxEcho]')

export function useInboxEcho() {
  const { $echo } = useNuxtApp()
  const store = useInboxStore()
  const authStore = useAuthStore()

  function subscribe(): void {
    const userId = authStore.user?.id
    if (!userId) return

    const channel = $echo.private(`dm.${userId}`)

    // New message received from the other participant
    channel.listen('.dm.message.received', (payload: {
      threadId: string
      message: ThreadMessage
      senderPreview: { id: string, name: string, avatar: string | null, frame: string | null }
    }) => {
      log.debug('dm.message.received', payload)
      if (store.activeThreadId === payload.threadId) {
        store.appendMessage(payload.message)
      }
      else {
        // Bump unread on the thread in whichever section it belongs
        const thread = store.threadById(payload.threadId)
        if (thread) {
          thread.unreadCount++
          thread.lastMessage = payload.message.content
          thread.lastMessageAt = payload.message.sentAt
        }
      }
    })

    // A message was unsent by the other participant
    channel.listen('.dm.message.unsent', (payload: { threadId: string, messageId: string }) => {
      log.debug('dm.message.unsent', payload)
      store.markMessageUnsent(payload.messageId)
    })

    // A stranger request you sent was accepted
    channel.listen('.dm.thread.accepted', (payload: { threadId: string }) => {
      log.debug('dm.thread.accepted', payload)
      const thread = store.threadById(payload.threadId)
      if (thread) store.upsertThread({ ...thread, kind: 'dm' })
    })

    // Someone sent you a new stranger request
    channel.listen('.dm.thread.request', (payload: {
      threadId: string
      thread: Thread
    }) => {
      log.debug('dm.thread.request', payload)
      store.upsertThread(payload.thread)
    })

    // New official message (badge bump only)
    channel.listen('.dm.official.received', () => {
      log.debug('dm.official.received')
      store.bumpOfficialUnread()
    })
  }

  function unsubscribe(): void {
    const userId = authStore.user?.id
    if (!userId) return
    $echo.leave(`dm.${userId}`)
  }

  return { subscribe, unsubscribe }
}
