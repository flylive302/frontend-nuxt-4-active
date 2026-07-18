// ========================================
// Inbox Actions Composable
// ========================================
// Orchestrates thread fetching, message sending, and thread management.
// All side-effects (store mutations) happen here; store stays mutation-only.

import { createLogger } from '~/utils/logger'
import type { Thread, ThreadsResponse, MessagesResponse, SendMessageResponse } from '~/types/inbox'

const log = createLogger('[useInboxActions]')

export function useInboxActions() {
  const store = useInboxStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ── Fetch all thread sections ─────────────────────────
  async function fetchThreads(): Promise<void> {
    if (store.threadsLoading) return

    store.setThreadsLoading(true)
    try {
      const res = await api<ThreadsResponse>('/inbox/threads')
      store.setThreads(res.data.official_unread, res.data.dm.data, res.data.requests, res.data.dm.next_cursor)
    }
    catch (err) {
      log.warn('Failed to fetch inbox threads', err)
      const { message } = normalizeError(err)
      toast.add({ title: message, color: 'error' })
    }
    finally {
      store.setThreadsLoading(false)
    }
  }

  // ── Load next page of DM threads (cursor pagination) ──
  async function loadMoreThreads(): Promise<void> {
    if (!store.dmNextCursor || store.threadsLoading) return

    store.setThreadsLoading(true)
    try {
      const res = await api<ThreadsResponse>('/inbox/threads', {
        params: { cursor: store.dmNextCursor },
      })
      store.appendDmThreads(res.data.dm.data, res.data.dm.next_cursor)
    }
    catch (err) {
      log.warn('Failed to load more inbox threads', err)
      const { message } = normalizeError(err)
      toast.add({ title: message, color: 'error' })
    }
    finally {
      store.setThreadsLoading(false)
    }
  }

  // ── Get-or-create thread with a user ─────────────────
  async function startThread(userId: string | number): Promise<Thread | null> {
    try {
      const res = await api<{ data: Thread }>(`/inbox/start/${userId}`, { method: 'POST' })
      store.upsertThread(res.data)
      return res.data
    }
    catch (err) {
      log.warn('Failed to start thread', err)
      return null
    }
  }

  // ── Load messages for a thread (initial load) ─────────
  async function loadMessages(threadId: string): Promise<void> {
    store.setMessagesLoading(true)
    try {
      const res = await api<MessagesResponse>(`/inbox/threads/${threadId}/messages`)
      store.setMessages(
        threadId,
        res.data.messages,
        res.data.nextCursor,
        res.data.nextCursor !== null,
      )
    }
    catch (err) {
      log.warn('Failed to load messages', err)
      const { message } = normalizeError(err)
      toast.add({ title: message, color: 'error' })
    }
    finally {
      store.setMessagesLoading(false)
    }
  }

  // ── Load older messages (cursor pagination) ───────────
  async function loadOlderMessages(threadId: string): Promise<void> {
    if (!store.messagesHasMore || store.messagesLoading || !store.messagesCursor) return

    store.setMessagesLoading(true)
    try {
      const res = await api<MessagesResponse>(`/inbox/threads/${threadId}/messages`, {
        params: { cursor: store.messagesCursor },
      })
      store.prependMessages(
        res.data.messages,
        res.data.nextCursor,
        res.data.nextCursor !== null,
      )
    }
    catch (err) {
      log.warn('Failed to load older messages', err)
      const { message } = normalizeError(err)
      toast.add({ title: message, color: 'error' })
    }
    finally {
      store.setMessagesLoading(false)
    }
  }

  // ── Send a message ────────────────────────────────────
  async function sendMessage(threadId: string, content: string): Promise<boolean> {
    if (!content.trim()) return false

    const tempId = `tmp-${Date.now()}`
    const authStore = useAuthStore()

    // Optimistic append
    store.appendMessage({
      id: tempId,
      threadId,
      senderId: String(authStore.user?.id ?? 'me'),
      content: content.trim(),
      type: 'text',
      kind: 'text',
      sentAt: new Date().toISOString(),
      readAt: null,
      unsent: false,
      isOwn: true,
    })

    try {
      const res = await api<SendMessageResponse>(`/inbox/threads/${threadId}/messages`, {
        method: 'POST',
        body: { content: content.trim(), type: 'text' },
      })
      store.replaceOptimisticMessage(tempId, res.data)
      return true
    }
    catch (err) {
      // Remove the failed optimistic message (don't mark as "unsent" — that's for intentional unsends)
      store.messages = store.messages.filter(m => m.id !== tempId)
      const { message } = normalizeError(err)
      toast.add({ title: message, color: 'error' })
      return false
    }
  }

  // ── Mark thread as read ───────────────────────────────
  async function markRead(threadId: string): Promise<void> {
    store.markThreadRead(threadId)
    try {
      await api(`/inbox/threads/${threadId}/read`, { method: 'POST' })
    }
    catch (err) {
      log.warn('Failed to mark thread as read', err)
    }
  }

  return { fetchThreads, loadMoreThreads, startThread, loadMessages, loadOlderMessages, sendMessage, markRead }
}
