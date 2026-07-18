/**
 * useDmPresence (dm-realtime-platform/07) — orchestrator that keeps
 * presence:subscribe/unsubscribe in sync with the contacts visible in the
 * open inbox (open thread peer + loaded thread list), and re-subscribes
 * with a fresh snapshot on socket reconnect.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, watch, computed, nextTick } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('computed', computed)

// ── Mock useAudioSocket — the only transport dependency ───
function createMockSocket() {
  return {
    connected: true,
    emit: vi.fn((_event: string, _payload: unknown, cb?: (res: unknown) => void) => {
      cb?.({ success: true, data: {} })
    }),
    once: vi.fn(),
    off: vi.fn(),
  }
}

let mockSocket: ReturnType<typeof createMockSocket>
const statusRef = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('connected')

vi.mock('../../app/composables/room/useAudioSocket', () => ({
  useAudioSocket: () => ({ socket: ref(mockSocket), status: statusRef }),
}))

// ── Mock useInboxStore (Pinia auto-import) ────────────────
const inboxStore = {
  activeThreadId: null as string | null,
  dmThreads: [] as Array<{ participant: { id: string } }>,
  requestThreads: [] as Array<{ participant: { id: string } }>,
  threadById: vi.fn(),
}
vi.stubGlobal('useInboxStore', () => inboxStore)

// ── Mock usePresenceStore (Pinia auto-import) ─────────────
function createPresenceStore() {
  const subscribed = new Set<number>()
  const online: Record<number, boolean> = {}
  return {
    onlineByUserId: online,
    subscribedUserIds: subscribed,
    setSubscriptions: vi.fn((ids: number[]) => {
      subscribed.clear()
      ids.forEach(id => subscribed.add(id))
    }),
    applySnapshot: vi.fn((snap: Record<number, boolean>) => {
      Object.assign(online, snap)
    }),
    setOnline: vi.fn(),
  }
}
let presenceStore: ReturnType<typeof createPresenceStore>
vi.stubGlobal('usePresenceStore', () => presenceStore)

describe('useDmPresence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockSocket = createMockSocket()
    statusRef.value = 'connected'
    inboxStore.activeThreadId = null
    inboxStore.dmThreads = []
    inboxStore.requestThreads = []
    inboxStore.threadById.mockReturnValue(undefined)
    presenceStore = createPresenceStore()
  })

  async function setup() {
    const { useDmPresence } = await import('../../app/composables/inbox/useDmPresence')
    return useDmPresence()
  }

  it('subscribes to the loaded thread list participants exactly, on init', async () => {
    inboxStore.dmThreads = [{ participant: { id: '1' } }, { participant: { id: '2' } }]

    await setup()
    await vi.waitFor(() => expect(mockSocket.emit).toHaveBeenCalled())

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'presence:subscribe',
      { userIds: [1, 2] },
      expect.any(Function),
    )
    expect(presenceStore.subscribedUserIds).toEqual(new Set([1, 2]))
  })

  it('includes the open thread peer even if not in the loaded list', async () => {
    inboxStore.activeThreadId = 'thread-9'
    inboxStore.threadById.mockReturnValue({ participant: { id: '9' } })

    await setup()
    await vi.waitFor(() => expect(mockSocket.emit).toHaveBeenCalled())

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'presence:subscribe',
      { userIds: [9] },
      expect.any(Function),
    )
  })

  it('applies the subscribe ack snapshot to the presence store', async () => {
    mockSocket.emit = vi.fn((_e, _p, cb) => cb?.({ success: true, data: { 1: true, 2: false } }))
    inboxStore.dmThreads = [{ participant: { id: '1' } }, { participant: { id: '2' } }]

    await setup()
    await vi.waitFor(() => expect(presenceStore.applySnapshot).toHaveBeenCalled())

    expect(presenceStore.applySnapshot).toHaveBeenCalledWith({ 1: true, 2: false })
  })

  it('diffing: removing a contact from the wanted set emits unsubscribe for it only', async () => {
    inboxStore.dmThreads = [{ participant: { id: '1' } }, { participant: { id: '2' } }]
    const { sync } = await setup()
    await vi.waitFor(() => expect(mockSocket.emit).toHaveBeenCalled())
    mockSocket.emit.mockClear()

    inboxStore.dmThreads = [{ participant: { id: '1' } }]
    await sync()

    expect(mockSocket.emit).toHaveBeenCalledWith('presence:unsubscribe', { userIds: [2] })
  })

  it('diffing: adding a new contact emits subscribe for it only', async () => {
    inboxStore.dmThreads = [{ participant: { id: '1' } }]
    const { sync } = await setup()
    await vi.waitFor(() => expect(mockSocket.emit).toHaveBeenCalled())
    mockSocket.emit.mockClear()

    inboxStore.dmThreads = [{ participant: { id: '1' } }, { participant: { id: '3' } }]
    await sync()

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'presence:subscribe',
      { userIds: [3] },
      expect.any(Function),
    )
  })

  it('stop() unsubscribes from every currently-subscribed id', async () => {
    inboxStore.dmThreads = [{ participant: { id: '1' } }, { participant: { id: '2' } }]
    const { stop } = await setup()
    await vi.waitFor(() => expect(mockSocket.emit).toHaveBeenCalled())
    mockSocket.emit.mockClear()

    stop()

    expect(mockSocket.emit).toHaveBeenCalledWith('presence:unsubscribe', { userIds: [1, 2] })
    expect(presenceStore.subscribedUserIds.size).toBe(0)
  })

  it('subscribes once the socket connects, even if it mounted while disconnected', async () => {
    statusRef.value = 'connecting'
    mockSocket.connected = false
    inboxStore.dmThreads = [{ participant: { id: '5' } }]

    await setup()
    await nextTick()
    expect(mockSocket.emit).not.toHaveBeenCalled()

    mockSocket.connected = true
    statusRef.value = 'connected'
    await vi.waitFor(() => expect(mockSocket.emit).toHaveBeenCalled())

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'presence:subscribe',
      { userIds: [5] },
      expect.any(Function),
    )
  })

  it('re-subscribes with a fresh snapshot on socket reconnect', async () => {
    inboxStore.dmThreads = [{ participant: { id: '1' } }]
    await setup()
    await vi.waitFor(() => expect(mockSocket.emit).toHaveBeenCalled())
    mockSocket.emit.mockClear()

    statusRef.value = 'connecting'
    await nextTick()
    statusRef.value = 'connected'
    await vi.waitFor(() => expect(mockSocket.emit).toHaveBeenCalled())

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'presence:subscribe',
      { userIds: [1] },
      expect.any(Function),
    )
  })
})
