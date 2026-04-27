// ========================================
// Inbox Store
// ========================================
// Reactive state for thread list and per-thread messages.
// No API calls — all mutations triggered by useInboxActions.

import { defineStore } from 'pinia'
import type { Thread, ThreadMessage } from '~/types/inbox'

export const useInboxStore = defineStore('inbox', () => {
  // ── Thread list ──────────────────────────────────────
  const threads = ref<Thread[]>([])
  const threadsLoading = ref(false)
  const threadsHasMore = ref(true)
  const threadsCursor = ref<number>(0)

  // ── Active thread messages ────────────────────────────
  const activeThreadId = ref<string | null>(null)
  const messages = ref<ThreadMessage[]>([])
  const messagesLoading = ref(false)

  // ── Computed ─────────────────────────────────────────
  const totalUnread = computed(() =>
    threads.value.reduce((sum, t) => sum + t.unreadCount, 0)
  )

  function threadById(id: string): Thread | undefined {
    return threads.value.find(t => t.id === id)
  }

  // ── Setters ───────────────────────────────────────────
  function setThreadsLoading(v: boolean): void { threadsLoading.value = v }
  function setMessagesLoading(v: boolean): void { messagesLoading.value = v }

  function appendThreadsPage(page: Thread[], hasMore: boolean): void {
    threads.value.push(...page)
    threadsHasMore.value = hasMore
    threadsCursor.value += page.length
  }

  function resetThreads(): void {
    threads.value = []
    threadsHasMore.value = true
    threadsCursor.value = 0
  }

  function setMessages(threadId: string, msgs: ThreadMessage[]): void {
    activeThreadId.value = threadId
    messages.value = msgs
  }

  function appendMessage(msg: ThreadMessage): void {
    messages.value.push(msg)
    // Update thread preview
    const thread = threads.value.find(t => t.id === msg.threadId)
    if (thread) {
      thread.lastMessage = msg.isOwn ? `You: ${msg.content}` : msg.content
      thread.lastMessageAt = msg.sentAt
    }
  }

  function markThreadRead(threadId: string): void {
    const thread = threads.value.find(t => t.id === threadId)
    if (thread) thread.unreadCount = 0
  }

  function $reset(): void {
    threads.value = []
    threadsLoading.value = false
    threadsHasMore.value = true
    threadsCursor.value = 0
    activeThreadId.value = null
    messages.value = []
    messagesLoading.value = false
  }

  return {
    threads,
    threadsLoading,
    threadsHasMore,
    threadsCursor,
    activeThreadId,
    messages,
    messagesLoading,
    totalUnread,
    threadById,
    setThreadsLoading,
    setMessagesLoading,
    appendThreadsPage,
    resetThreads,
    setMessages,
    appendMessage,
    markThreadRead,
    $reset,
  }
})
