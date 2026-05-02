// ========================================
// Inbox Thread Composable
// ========================================
// Thread-level actions: accept, deny, delete message, unsend.

import { createLogger } from '~/utils/logger'
import type { Thread } from '~/types/inbox'

const log = createLogger('[useInboxThread]')

export function useInboxThread() {
  const store = useInboxStore()
  const { api } = useApi()
  const toast = useToast()

  // ── Accept a stranger request ─────────────────────────
  async function acceptRequest(threadId: string): Promise<Thread | null> {
    try {
      const res = await api<{ data: Thread }>(`/inbox/threads/${threadId}/accept`, { method: 'POST' })
      store.upsertThread(res.data)
      return res.data
    }
    catch (err) {
      log.error('acceptRequest failed:', err)
      toast.add({ title: 'Could not accept request', color: 'error' })
      return null
    }
  }

  // ── Deny a stranger request (auto-blocks sender) ──────
  async function denyRequest(threadId: string): Promise<boolean> {
    try {
      await api(`/inbox/threads/${threadId}/deny`, { method: 'POST' })
      store.removeThread(threadId)
      return true
    }
    catch (err) {
      log.error('denyRequest failed:', err)
      toast.add({ title: 'Could not deny request', color: 'error' })
      return false
    }
  }

  // ── Delete a message for current user only ────────────
  async function deleteMessage(messageId: string): Promise<boolean> {
    try {
      await api(`/inbox/messages/${messageId}`, { method: 'DELETE' })
      store.messages.splice(
        store.messages.findIndex(m => m.id === messageId),
        1,
      )
      return true
    }
    catch (err) {
      log.error('deleteMessage failed:', err)
      toast.add({ title: 'Could not delete message', color: 'error' })
      return false
    }
  }

  // ── Unsend a message for both sides ───────────────────
  async function unsendMessage(messageId: string): Promise<boolean> {
    try {
      await api(`/inbox/messages/${messageId}/unsend`, { method: 'POST' })
      store.markMessageUnsent(messageId)
      return true
    }
    catch (err) {
      log.error('unsendMessage failed:', err)
      toast.add({ title: 'Cannot unsend — time window has passed', color: 'warning' })
      return false
    }
  }

  return { acceptRequest, denyRequest, deleteMessage, unsendMessage }
}
