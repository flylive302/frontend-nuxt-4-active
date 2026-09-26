/**
 * useInboxActions — openThread/closeThread + the stale-response guards on
 * loadMessages/loadOlderMessages (dm-messenger stale-content fixes).
 *
 * Uses the REAL Pinia store (useInboxStore) so setActiveThread/clearMessages/
 * setMessages behave exactly as in production; only the API/toast/auth layer
 * is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import { useInboxStore } from '../../app/stores/inbox'
import type { ThreadMessage } from '~/types/inbox'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

function msg(id: string, threadId: string): ThreadMessage {
  return {
    id,
    threadId,
    senderId: '1',
    content: `msg-${id}`,
    type: 'text',
    kind: 'text',
    sentAt: '2026-01-01T00:00:00Z',
    readAt: null,
    unsent: false,
    isOwn: false,
  } as ThreadMessage
}

describe('useInboxActions — openThread/closeThread/loadMessages guards', () => {
  const api = vi.fn()
  const toastAdd = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('useInboxStore', useInboxStore)
    vi.stubGlobal('useApi', () => ({ api, normalizeError: () => ({ message: 'x' }) }))
    vi.stubGlobal('useToast', () => ({ add: toastAdd }))
    vi.stubGlobal('useAuthStore', () => ({ user: { id: 1 } }))
    api.mockReset()
    toastAdd.mockReset()
  })

  describe('openThread', () => {
    it('clears the list, sets messagesLoading, and sets active when switching threads', async () => {
      const { useInboxActions } = await import('../../app/composables/inbox/useInboxActions')
      const store = useInboxStore()
      store.messages = [msg('1', 'X')]

      const { openThread } = useInboxActions()
      openThread('Y')

      expect(store.messages).toEqual([])
      expect(store.messagesLoading).toBe(true)
      expect(store.activeThreadId).toBe('Y')
    })

    it('keeps the list when it already holds only this thread’s messages', async () => {
      const { useInboxActions } = await import('../../app/composables/inbox/useInboxActions')
      const store = useInboxStore()
      const existing = [msg('1', 'X'), msg('2', 'X')]
      store.messages = existing
      store.setMessagesLoading(false)

      const { openThread } = useInboxActions()
      openThread('X')

      expect(store.messages).toEqual(existing)
      expect(store.messagesLoading).toBe(false)
      expect(store.activeThreadId).toBe('X')
    })

    it('sets messagesLoading true when opening on an empty list', async () => {
      const { useInboxActions } = await import('../../app/composables/inbox/useInboxActions')
      const store = useInboxStore()

      const { openThread } = useInboxActions()
      openThread('X')

      expect(store.messages).toEqual([])
      expect(store.messagesLoading).toBe(true)
      expect(store.activeThreadId).toBe('X')
    })
  })

  describe('closeThread', () => {
    it('does not clear active thread when a newer view already owns it', async () => {
      const { useInboxActions } = await import('../../app/composables/inbox/useInboxActions')
      const store = useInboxStore()
      store.setActiveThread('Y')

      const { closeThread } = useInboxActions()
      closeThread('X')

      expect(store.activeThreadId).toBe('Y')
    })

    it('clears active thread when it matches', async () => {
      const { useInboxActions } = await import('../../app/composables/inbox/useInboxActions')
      const store = useInboxStore()
      store.setActiveThread('Y')

      const { closeThread } = useInboxActions()
      closeThread('Y')

      expect(store.activeThreadId).toBeNull()
    })
  })

  describe('loadMessages', () => {
    it('drops the response if the active thread changed mid-flight', async () => {
      let resolveApi!: (v: unknown) => void
      api.mockReturnValueOnce(new Promise((resolve) => { resolveApi = resolve }))

      const { useInboxActions } = await import('../../app/composables/inbox/useInboxActions')
      const store = useInboxStore()
      store.setActiveThread('X')

      const { loadMessages } = useInboxActions()
      const promise = loadMessages('X')

      // User switches threads while the request is in flight.
      store.setActiveThread('Y')
      store.setMessagesLoading(true)

      resolveApi({ data: { messages: [msg('1', 'X')], nextCursor: null } })
      await promise

      expect(store.messages).toEqual([])
      expect(store.activeThreadId).toBe('Y')
      // X's finally must not clear the loading flag that now belongs to Y.
      expect(store.messagesLoading).toBe(true)
    })

    it('applies the response when the thread is still active', async () => {
      api.mockResolvedValueOnce({
        data: { messages: [msg('2', 'Y'), msg('1', 'Y')], nextCursor: 'cur-1' },
      })

      const { useInboxActions } = await import('../../app/composables/inbox/useInboxActions')
      const store = useInboxStore()
      store.setActiveThread('Y')

      const { loadMessages } = useInboxActions()
      await loadMessages('Y')

      // API returns newest-first; store reverses to chronological order.
      expect(store.messages.map(m => m.id)).toEqual(['1', '2'])
      expect(store.messagesLoading).toBe(false)
      expect(store.messagesCursor).toBe('cur-1')
      expect(store.messagesHasMore).toBe(true)
    })
  })

  describe('loadOlderMessages', () => {
    it('drops the response if the active thread changed mid-flight', async () => {
      let resolveApi!: (v: unknown) => void
      api.mockReturnValueOnce(new Promise((resolve) => { resolveApi = resolve }))

      const { useInboxActions } = await import('../../app/composables/inbox/useInboxActions')
      const store = useInboxStore()
      store.setActiveThread('X')
      store.setMessages([msg('5', 'X')], 'cur-0', true)

      const { loadOlderMessages } = useInboxActions()
      const promise = loadOlderMessages('X')

      store.setActiveThread('Y')

      resolveApi({ data: { messages: [msg('1', 'X')], nextCursor: null } })
      await promise

      // Older X messages must not have been prepended once the view moved to Y.
      expect(store.messages.map(m => m.id)).toEqual(['5'])
      expect(store.activeThreadId).toBe('Y')
    })
  })
})
