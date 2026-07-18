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
  const dmNextCursor = ref<string | null>(null)
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
    () => officialUnreadCount.value
      + dmThreads.value.reduce((s, t) => s + t.unreadCount, 0)
      + requestThreads.value.reduce((s, t) => s + t.unreadCount, 0),
  )

  /** DM + request unread only (for chat icon badge, excludes official) */
  const dmUnread = computed(
    () => dmThreads.value.reduce((s, t) => s + t.unreadCount, 0)
      + requestThreads.value.reduce((s, t) => s + t.unreadCount, 0),
  )


  function threadById(id: string | number): Thread | undefined {
    const sid = String(id)
    return dmThreads.value.find(t => String(t.id) === sid) ?? requestThreads.value.find(t => String(t.id) === sid)
  }

  // ── Setters ───────────────────────────────────────────
  function setThreadsLoading(v: boolean): void {
    threadsLoading.value = v
  }

  function setMessagesLoading(v: boolean): void {
    messagesLoading.value = v
  }

  function setThreads(officialUnread: number, dm: Thread[], requests: Thread[], dmCursor: string | null = null): void {
    officialUnreadCount.value = officialUnread
    dmThreads.value = dm
    dmNextCursor.value = dmCursor
    requestThreads.value = requests
    threadsLoaded.value = true
  }

  function appendDmThreads(threads: Thread[], dmCursor: string | null): void {
    const existingIds = new Set(dmThreads.value.map(t => String(t.id)))
    dmThreads.value = [...dmThreads.value, ...threads.filter(t => !existingIds.has(String(t.id)))]
    dmNextCursor.value = dmCursor
  }

  function setDmNextCursor(cursor: string | null): void {
    dmNextCursor.value = cursor
  }

  function upsertThread(thread: Thread): void {
    if (thread.kind === 'dm') {
      const idx = dmThreads.value.findIndex(t => String(t.id) === String(thread.id))
      if (idx >= 0) {
        dmThreads.value[idx] = thread
      }
      else {
        dmThreads.value.unshift(thread)
      }
      // Remove from requests if it was just accepted
      requestThreads.value = requestThreads.value.filter(t => String(t.id) !== String(thread.id))
    }
    else if (thread.kind === 'request') {
      const idx = requestThreads.value.findIndex(t => String(t.id) === String(thread.id))
      if (idx >= 0) {
        requestThreads.value[idx] = thread
      }
      else {
        requestThreads.value.unshift(thread)
      }
    }
  }

  function removeThread(threadId: string | number): void {
    const sid = String(threadId)
    dmThreads.value = dmThreads.value.filter(t => String(t.id) !== sid)
    requestThreads.value = requestThreads.value.filter(t => String(t.id) !== sid)
  }

  function setMessages(threadId: string, msgs: ThreadMessage[], cursor: string | null, hasMore: boolean): void {
    activeThreadId.value = threadId
    messages.value = [...msgs].reverse() // API returns newest-first; reverse for chronological display
    messagesCursor.value = cursor
    messagesHasMore.value = hasMore
  }

  function prependMessages(msgs: ThreadMessage[], cursor: string | null, hasMore: boolean): void {
    messages.value = [...msgs].reverse().concat(messages.value) // Reverse older batch before prepending
    messagesCursor.value = cursor
    messagesHasMore.value = hasMore
  }

  function appendMessage(msg: ThreadMessage): void {
    // Avoid duplicates from optimistic + confirmed echo
    if (messages.value.some(m => String(m.id) === String(msg.id))) return
    messages.value.push(msg)
    bumpThread(msg.threadId, msg)
  }

  function replaceOptimisticMessage(tempId: string, confirmed: ThreadMessage): void {
    const idx = messages.value.findIndex(m => String(m.id) === String(tempId))
    if (idx >= 0) messages.value[idx] = confirmed
    bumpThread(confirmed.threadId, confirmed)
  }

  function markMessageUnsent(messageId: string | number): void {
    const sid = String(messageId)
    const msg = messages.value.find(m => String(m.id) === sid)
    if (msg) {
      msg.unsent = true
      msg.content = ''
    }
  }

  function markThreadRead(threadId: string | number): void {
    const thread = threadById(threadId)
    if (thread) thread.unreadCount = 0
  }

  /** Update the peer's seen watermark for a thread (dm.thread.seen hint / reconcile). */
  function setPeerSeenUpTo(threadId: string | number, seenUpToMessageId: string | number): void {
    const thread = threadById(threadId)
    if (thread) thread.peerSeenUpToMessageId = String(seenUpToMessageId)
  }

  function bumpOfficialUnread(): void {
    officialUnreadCount.value++
  }

  function clearOfficialUnread(): void {
    officialUnreadCount.value = 0
  }

  function bumpThreadUnread(threadId: string | number, content: string, sentAt: string): void {
    const sid = String(threadId)
    const thread = threadById(sid)
    if (!thread) return
    thread.unreadCount++
    thread.lastMessage = content
    thread.lastMessageAt = sentAt
    // Bubble to top of its section
    if (thread.kind === 'dm') {
      dmThreads.value = [thread, ...dmThreads.value.filter(t => String(t.id) !== sid)]
    }
    else if (thread.kind === 'request') {
      requestThreads.value = [thread, ...requestThreads.value.filter(t => String(t.id) !== sid)]
    }
  }

  // ── Private helpers ───────────────────────────────────
  function bumpThread(threadId: string | number, msg: ThreadMessage): void {
    const sid = String(threadId)
    const thread = threadById(sid)
    if (!thread) return
    thread.lastMessage = msg.isOwn ? `You: ${msg.content}` : msg.content
    thread.lastMessageAt = msg.sentAt
    // Bubble to top of its section
    if (thread.kind === 'dm') {
      dmThreads.value = [thread, ...dmThreads.value.filter(t => String(t.id) !== sid)]
    }
  }

  function $reset(): void {
    officialUnreadCount.value = 0
    dmThreads.value = []
    dmNextCursor.value = null
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
    dmNextCursor,
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
    appendDmThreads,
    setDmNextCursor,
    upsertThread,
    removeThread,
    setMessages,
    prependMessages,
    appendMessage,
    replaceOptimisticMessage,
    markMessageUnsent,
    markThreadRead,
    setPeerSeenUpTo,
    bumpThreadUnread,
    bumpOfficialUnread,
    clearOfficialUnread,
    $reset,
  }
})
