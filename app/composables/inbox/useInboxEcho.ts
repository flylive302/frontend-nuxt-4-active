// ========================================
// Inbox Real-Time Handler
// ========================================
// Subscribes to private-dm.{userId} and wires Reverb events → store.
// Call subscribe() after login; unsubscribe() on logout.

import type { Thread, ThreadMessage } from '~/types/inbox'


export function useInboxEcho() {
  const { $echo } = useNuxtApp()
  const store = useInboxStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const { fetchThreads } = useInboxActions()

  function subscribe(): void {
    const userId = authStore.user?.id
    if (!userId) return

    const channel = $echo.private(`dm.${userId}`)
    if (!channel) return

    // New message received from the other participant
    channel.listen('.dm.message.received', (payload: {
      threadId: number | string
      message: ThreadMessage
    }) => {
      const tid = String(payload.threadId)
      // Normalize IDs to strings (PHP sends integers, Vue routes use strings)
      const msg: ThreadMessage = { ...payload.message, threadId: tid }
      if (store.activeThreadId === tid) {
        store.appendMessage(msg)
      }
      else {
        store.bumpThreadUnread(tid, msg.content, msg.sentAt)
        // If thread not in store (e.g. was deleted), refetch thread list
        if (!store.threadById(tid)) {
          fetchThreads()
        }
      }
    })

    // A message was unsent by the other participant
    channel.listen('.dm.message.unsent', (payload: { threadId: string, messageId: string }) => {
      store.markMessageUnsent(String(payload.messageId))
    })

    // A stranger request you sent was accepted
    channel.listen('.dm.thread.accepted', (payload: { threadId: string | number }) => {
      const tid = String(payload.threadId)
      const thread = store.threadById(tid)
      if (thread) store.upsertThread({ ...thread, kind: 'dm' })
    })

    // Someone sent you a new stranger request
    channel.listen('.dm.thread.request', (payload: {
      threadId: string | number
      thread: Thread
    }) => {
      // Normalize thread ID to string
      const thread: Thread = { ...payload.thread, id: String(payload.thread.id) }
      store.upsertThread(thread)
    })

    // New official message received (broadcast, targeted, or filtered)
    channel.listen('.official.message.received', (payload: {
      id: number
      content: string
      sentAt: string
    }) => {
      store.bumpOfficialUnread()

      toast.add({
        title: 'FlyLive',
        description: payload.content?.substring(0, 80) || 'New official message',
        icon: 'i-lucide-megaphone',
        color: 'primary',
      })
    })
  }

  function unsubscribe(): void {
    const userId = authStore.user?.id
    if (!userId) return
    $echo.leave(`dm.${userId}`)
  }

  return { subscribe, unsubscribe }
}
