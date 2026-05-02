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
      store.setThreads(res.data.official_unread, res.data.dm, res.data.requests)
    }
    catch (err) {
      log.error('fetchThreads failed:', err)
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
      log.error('startThread failed:', err)
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
      log.error('loadMessages failed:', err)
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
      log.error('loadOlderMessages failed:', err)
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
      store.markMessageUnsent(tempId)
      log.error('sendMessage failed:', err)
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
      log.error('markRead failed:', err)
    }
  }

  return { fetchThreads, startThread, loadMessages, loadOlderMessages, sendMessage, markRead }
}
