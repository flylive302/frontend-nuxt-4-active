/**
 * useInboxEvents (app/events/inbox.events.ts) — REACT-only socket handlers
 * for the Inbox domain (dm.message.received, dm.message.unsent,
 * dm.thread.request, dm.thread.accepted, official.message.received),
 * migrated off Laravel Reverb/Echo onto the MSAB fan-out
 * (dm-realtime-platform/02). Verifies each handler maps to a store mutation
 * (+ toast for official messages) with no business logic / API calls.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Thread } from '~/types/inbox'

function createMockSocket() {
  const handlers = new Map<string, (payload: unknown) => void>()
  return {
    handlers,
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      handlers.set(event, cb)
    }),
  }
}

// ── Mock useInboxStore (Pinia auto-import) ────────────────
const store = {
  activeThreadId: null as string | null,
  appendMessage: vi.fn(),
  bumpThreadUnread: vi.fn(),
  markMessageUnsent: vi.fn(),
  upsertThread: vi.fn(),
  threadById: vi.fn<(id: string) => Thread | undefined>(),
  bumpOfficialUnread: vi.fn(),
  setPeerSeenUpTo: vi.fn(),
}
vi.stubGlobal('useInboxStore', () => store)

// ── Mock useToast (NuxtUI auto-import) ────────────────────
const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

describe('useInboxEvents', () => {
  let socket: ReturnType<typeof createMockSocket>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    store.activeThreadId = null
    store.threadById.mockReturnValue(undefined)

    const { useInboxEvents } = await import('../../app/events/inbox.events')
    socket = createMockSocket()
    useInboxEvents()(socket as never)
  })

  it('registers handlers for all six inbox events', () => {
    expect(socket.handlers.has('dm.message.received')).toBe(true)
    expect(socket.handlers.has('dm.message.unsent')).toBe(true)
    expect(socket.handlers.has('dm.thread.request')).toBe(true)
    expect(socket.handlers.has('dm.thread.accepted')).toBe(true)
    expect(socket.handlers.has('dm.thread.seen')).toBe(true)
    expect(socket.handlers.has('official.message.received')).toBe(true)
  })

  it('dm.thread.seen updates the peer seen watermark for the thread', () => {
    socket.handlers.get('dm.thread.seen')!({ threadId: 42, seenUpToMessageId: 7 })

    expect(store.setPeerSeenUpTo).toHaveBeenCalledWith('42', '7')
  })

  describe('dm.message.received', () => {
    const payload = {
      threadId: 42,
      message: {
        id: 1,
        threadId: 42,
        senderId: 7,
        content: 'hey',
        type: 'text',
        kind: 'text',
        sentAt: '2026-07-18T00:00:00Z',
        readAt: null,
        unsent: false,
        isOwn: false,
      },
    }

    it('appends the message when the thread is active', () => {
      store.activeThreadId = '42'

      socket.handlers.get('dm.message.received')!(payload)

      expect(store.appendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', threadId: '42', senderId: '7', content: 'hey' }),
      )
      expect(store.bumpThreadUnread).not.toHaveBeenCalled()
    })

    it('bumps thread unread when thread is present but not active', () => {
      store.activeThreadId = null
      store.threadById.mockReturnValue({ id: '42' } as Thread)

      socket.handlers.get('dm.message.received')!(payload)

      expect(store.bumpThreadUnread).toHaveBeenCalledWith('42', 'hey', payload.message.sentAt)
      expect(store.appendMessage).not.toHaveBeenCalled()
    })

    it('does nothing (no API call) when the thread is not present locally', () => {
      store.activeThreadId = null
      store.threadById.mockReturnValue(undefined)

      socket.handlers.get('dm.message.received')!(payload)

      expect(store.appendMessage).not.toHaveBeenCalled()
      expect(store.bumpThreadUnread).not.toHaveBeenCalled()
    })
  })

  it('dm.message.unsent marks the message unsent', () => {
    socket.handlers.get('dm.message.unsent')!({ threadId: 42, messageId: 9 })

    expect(store.markMessageUnsent).toHaveBeenCalledWith('9')
  })

  it('dm.thread.request upserts the normalized thread', () => {
    socket.handlers.get('dm.thread.request')!({
      threadId: 42,
      thread: {
        id: 42,
        kind: 'request',
        participant: { id: 7, name: 'Alex', avatar: null, frame_id: null, signature: null, gender: null },
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 1,
        requestMessageCount: 1,
        acceptedAt: null,
        isInitiator: false,
      },
    })

    expect(store.upsertThread).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '42',
        kind: 'request',
        participant: expect.objectContaining({ id: '7', name: 'Alex' }),
      }),
    )
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New message request', description: expect.stringContaining('Alex') }),
    )
  })

  describe('dm.thread.accepted', () => {
    it('upserts the thread as kind dm and toasts with the participant name when found locally', () => {
      const thread = { id: '42', kind: 'request', participant: { name: 'Alex' } } as Thread
      store.threadById.mockReturnValue(thread)

      socket.handlers.get('dm.thread.accepted')!({ threadId: 42 })

      expect(store.upsertThread).toHaveBeenCalledWith({ ...thread, kind: 'dm' })
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Request accepted', description: expect.stringContaining('Alex') }),
      )
    })

    it('does not mutate the store but still toasts generically when the thread is not present locally', () => {
      store.threadById.mockReturnValue(undefined)

      socket.handlers.get('dm.thread.accepted')!({ threadId: 42 })

      expect(store.upsertThread).not.toHaveBeenCalled()
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Request accepted', description: 'Your message request was accepted' }),
      )
    })
  })

  it('official.message.received bumps unread and toasts', () => {
    socket.handlers.get('official.message.received')!({
      id: 5,
      content: 'App-wide announcement',
      isTargeted: false,
      isFiltered: false,
      sentAt: '2026-07-18T00:00:00Z',
    })

    expect(store.bumpOfficialUnread).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'FlyLive', description: 'App-wide announcement' }),
    )
  })
})
