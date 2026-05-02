// ========================================
// Inbox Store
// ========================================
// Reactive state for thread list and per-thread messages.
// No API calls — all mutations triggered by composables.

import { defineStore } from 'pinia'
import type { Thread, ThreadMessage } from '~/types/inbox'

export const useInboxStore = defineStore('inbox', () => {
  // ── Thread sections ──────────────────────────────────
  const officialUnreadCount = ref(0)
  const dmThreads = ref<Thread[]>([])
  const requestThreads = ref<Thread[]>([])
  const threadsLoaded = ref(false)
  const threadsLoading = ref(false)

  // ── Active thread messages ────────────────────────────
  const activeThreadId = ref<string | null>(null)
  const messages = ref<ThreadMessage[]>([])
  const messagesLoading = ref(false)
  const messagesCursor = ref<string | null>(null)
  const messagesHasMore = ref(true)

  // ── Computed ─────────────────────────────────────────
  const totalUnread = computed(
    () => officialUnreadCount.value + dmThreads.value.reduce((s, t) => s + t.unreadCount, 0),
  )

  const dmUnread = computed(() => dmThreads.value.reduce((s, t) => s + t.unreadCount, 0))

  function threadById(id: string): Thread | undefined {
    return dmThreads.value.find(t => t.id === id) ?? requestThreads.value.find(t => t.id === id)
  }

  // ── Setters ───────────────────────────────────────────
  function setThreadsLoading(v: boolean): void {
    threadsLoading.value = v
  }

  function setMessagesLoading(v: boolean): void {
    messagesLoading.value = v
  }

  function setThreads(officialUnread: number, dm: Thread[], requests: Thread[]): void {
    officialUnreadCount.value = officialUnread
    dmThreads.value = dm
    requestThreads.value = requests
    threadsLoaded.value = true
  }

  function upsertThread(thread: Thread): void {
    if (thread.kind === 'dm') {
      const idx = dmThreads.value.findIndex(t => t.id === thread.id)
      if (idx >= 0) {
        dmThreads.value[idx] = thread
      }
      else {
        dmThreads.value.unshift(thread)
      }
      // Remove from requests if it was just accepted
      requestThreads.value = requestThreads.value.filter(t => t.id !== thread.id)
    }
    else if (thread.kind === 'request') {
      const idx = requestThreads.value.findIndex(t => t.id === thread.id)
      if (idx >= 0) {
        requestThreads.value[idx] = thread
      }
      else {
        requestThreads.value.unshift(thread)
      }
    }
  }

  function removeThread(threadId: string): void {
    dmThreads.value = dmThreads.value.filter(t => t.id !== threadId)
    requestThreads.value = requestThreads.value.filter(t => t.id !== threadId)
  }

  function setMessages(threadId: string, msgs: ThreadMessage[], cursor: string | null, hasMore: boolean): void {
    activeThreadId.value = threadId
    messages.value = msgs
    messagesCursor.value = cursor
    messagesHasMore.value = hasMore
  }

  function prependMessages(msgs: ThreadMessage[], cursor: string | null, hasMore: boolean): void {
    messages.value = [...msgs, ...messages.value]
    messagesCursor.value = cursor
    messagesHasMore.value = hasMore
  }

  function appendMessage(msg: ThreadMessage): void {
    // Avoid duplicates from optimistic + confirmed echo
    if (messages.value.some(m => m.id === msg.id)) return
    messages.value.push(msg)
    bumpThread(msg.threadId, msg)
  }

  function replaceOptimisticMessage(tempId: string, confirmed: ThreadMessage): void {
    const idx = messages.value.findIndex(m => m.id === tempId)
    if (idx >= 0) messages.value[idx] = confirmed
    bumpThread(confirmed.threadId, confirmed)
  }

  function markMessageUnsent(messageId: string): void {
    const msg = messages.value.find(m => m.id === messageId)
    if (msg) {
      msg.unsent = true
      msg.content = ''
    }
  }

  function markThreadRead(threadId: string): void {
    const thread = threadById(threadId)
    if (thread) thread.unreadCount = 0
  }

  function bumpOfficialUnread(): void {
    officialUnreadCount.value++
  }

  function clearOfficialUnread(): void {
    officialUnreadCount.value = 0
  }

  // ── Private helpers ───────────────────────────────────
  function bumpThread(threadId: string, msg: ThreadMessage): void {
    const thread = threadById(threadId)
    if (!thread) return
    thread.lastMessage = msg.isOwn ? `You: ${msg.content}` : msg.content
    thread.lastMessageAt = msg.sentAt
    // Bubble to top of its section
    if (thread.kind === 'dm') {
      dmThreads.value = [thread, ...dmThreads.value.filter(t => t.id !== threadId)]
    }
  }

  function $reset(): void {
    officialUnreadCount.value = 0
    dmThreads.value = []
    requestThreads.value = []
    threadsLoaded.value = false
    threadsLoading.value = false
    activeThreadId.value = null
    messages.value = []
    messagesLoading.value = false
    messagesCursor.value = null
    messagesHasMore.value = true
  }

  return {
    officialUnreadCount,
    dmThreads,
    requestThreads,
    threadsLoaded,
    threadsLoading,
    activeThreadId,
    messages,
    messagesLoading,
    messagesCursor,
    messagesHasMore,
    totalUnread,
    dmUnread,
    threadById,
    setThreadsLoading,
    setMessagesLoading,
    setThreads,
    upsertThread,
    removeThread,
    setMessages,
    prependMessages,
    appendMessage,
    replaceOptimisticMessage,
    markMessageUnsent,
    markThreadRead,
    bumpOfficialUnread,
    clearOfficialUnread,
    $reset,
  }
})
