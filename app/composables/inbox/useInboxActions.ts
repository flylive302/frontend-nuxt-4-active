// ========================================
// Inbox Actions Composable
// ========================================
// Orchestrates thread fetching and message sending.
// Dummy-data implementation — swap $fetch calls in for real API later.

import { DUMMY_THREADS } from '~/constants/inbox/threads'
import { DUMMY_MESSAGES } from '~/constants/inbox/messages'
import type { ThreadMessage } from '~/types/inbox'

const PAGE_SIZE = 10

export function useInboxActions() {
  const inboxStore = useInboxStore()

  // ── Fetch thread list (paginated) ─────────────────────
  async function fetchThreads(reset = false): Promise<void> {
    if (reset) inboxStore.resetThreads()
    if (!inboxStore.threadsHasMore && !reset) return

    // GATE
    if (inboxStore.threadsLoading) return

    // EXECUTE
    inboxStore.setThreadsLoading(true)
    try {
      // Simulated async delay so the loading state is visible
      await new Promise(r => setTimeout(r, 400))

      const offset = inboxStore.threadsCursor
      const page = DUMMY_THREADS.slice(offset, offset + PAGE_SIZE)
      const hasMore = offset + PAGE_SIZE < DUMMY_THREADS.length

      inboxStore.appendThreadsPage(page, hasMore)
    } finally {
      inboxStore.setThreadsLoading(false)
    }
  }

  // ── Load messages for a given thread ─────────────────
  async function loadMessages(threadId: string): Promise<void> {
    // GATE
    if (inboxStore.activeThreadId === threadId) return

    // EXECUTE
    inboxStore.setMessagesLoading(true)
    try {
      await new Promise(r => setTimeout(r, 250))
      const msgs = DUMMY_MESSAGES[threadId] ?? []
      inboxStore.setMessages(threadId, msgs)
      inboxStore.markThreadRead(threadId)
    } finally {
      inboxStore.setMessagesLoading(false)
    }
  }

  // ── Send a message ────────────────────────────────────
  async function sendMessage(threadId: string, content: string): Promise<boolean> {
    // GATE
    if (!content.trim()) return false

    // EXECUTE — optimistic append
    const msg: ThreadMessage = {
      id: `tmp-${Date.now()}`,
      threadId,
      senderId: 'me',
      content: content.trim(),
      sentAt: new Date().toISOString(),
      isOwn: true,
    }
    inboxStore.appendMessage(msg)

    // REACT — simulate delivered echo (no-op for real API, replaces tmp id)
    return true
  }

  return { fetchThreads, loadMessages, sendMessage }
}
