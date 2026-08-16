import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RECONNECT_FAILED_TOAST_ID } from '../../app/constants/room'

// ============================================================
// aws-production 21 — a client follows its Room when it moves.
//
// Scaffolding that exists and has never run is worse than absent.
// These tests FAIL against the pre-fix code on purpose:
//  - the reconnect handler fired fetchRoomById as a floating promise
//    and joinRoom read hosting_url synchronously, before the refresh
//    landed (useRoomLifecycle.ts Watcher 3);
//  - the rebuild path reconnected to the config URL, never the room's
//    refreshed address.
// ============================================================

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)

vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => ref('visible'),
  useEventListener: vi.fn(),
  useIntervalFn: vi.fn(),
}))

const OLD_URL = 'https://msab-old.audio.flyliveapp.com'
const NEW_URL = 'https://msab-new.audio.flyliveapp.com'
const ROOM_ID = 7

type FakeRoom = { id: number; hosting_url: string }

// --- collaborator mocks, re-wired per test in setup() ---
let reconnectCb: (() => Promise<void> | void) | null = null
let reconnectFailedCb: (() => Promise<void> | void) | null = null

const joinRoomMock = vi.fn()
const leaveRoomMock = vi.fn()
const connectSocketMock = vi.fn()
const disconnectSocketMock = vi.fn()
const fetchRoomByIdMock = vi.fn()
const toastAdd = vi.fn()
const toastRemove = vi.fn()

const roomStore = reactive({
  currentRoom: null as FakeRoom | null,
  isMinimized: false,
  previousRoute: null as string | null,
  leaveRoom: vi.fn(),
  touchActiveRoom: vi.fn(),
})

const connectivityStore = reactive({ isOffline: false, restoredAt: 0 })

vi.stubGlobal('useRoomStore', () => roomStore)
vi.stubGlobal('useGiftStore', () => ({ clearPlayback: vi.fn() }))
vi.stubGlobal('useRoomSeatsStore', () => ({ resetSeats: vi.fn(), seats: [] }))
vi.stubGlobal('useAuthStore', () => ({ user: null }))
vi.stubGlobal('useConnectivityStore', () => connectivityStore)
vi.stubGlobal('useToast', () => ({ add: toastAdd, remove: toastRemove }))
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useRoomAudio', () => ({
  joinRoom: joinRoomMock,
  leaveRoom: leaveRoomMock,
  recoverPlayback: vi.fn(),
  probeAudioHealth: vi.fn(),
  connectionStatus: ref('connected'),
  onTransportExhausted: vi.fn(),
}))
vi.stubGlobal('useAudioSocket', () => ({
  connect: connectSocketMock,
  disconnect: disconnectSocketMock,
  onReconnect: (cb: () => Promise<void>) => { reconnectCb = cb },
  onReconnectFailed: (cb: () => Promise<void>) => { reconnectFailedCb = cb },
}))
vi.stubGlobal('useRoom', () => ({ fetchRoomById: fetchRoomByIdMock }))
// node env has no window; the pagehide listener target just needs to exist
// (the vueuse useEventListener mock never attaches it).
vi.stubGlobal('window', { location: { pathname: '/' } })

async function flush(times = 8) {
  for (let i = 0; i < times; i++) {
    await nextTick()
    await Promise.resolve()
  }
}

async function setup() {
  roomStore.currentRoom = { id: ROOM_ID, hosting_url: OLD_URL }
  const { useRoomLifecycle } = await import('../../app/composables/room/useRoomLifecycle')
  useRoomLifecycle()
  // Watcher 1 (immediate) joins the room once on setup — let it settle, then
  // clear the mocks so each test only sees its own path.
  await flush()
  joinRoomMock.mockClear()
  connectSocketMock.mockClear()
  fetchRoomByIdMock.mockClear()
  toastAdd.mockClear()
  toastRemove.mockClear()
}

/** fetchRoomById that lands the re-pinned address one microtask later. */
function fetchMovesRoomTo(url: string) {
  fetchRoomByIdMock.mockImplementation(async () => {
    await Promise.resolve()
    if (roomStore.currentRoom) roomStore.currentRoom.hosting_url = url
  })
}

beforeEach(() => {
  vi.resetModules()
  reconnectCb = null
  reconnectFailedCb = null
  joinRoomMock.mockReset().mockResolvedValue(undefined)
  connectSocketMock.mockReset().mockResolvedValue(undefined)
  fetchRoomByIdMock.mockReset().mockResolvedValue(undefined)
  disconnectSocketMock.mockReset()
  toastAdd.mockReset()
  toastRemove.mockReset()
  roomStore.currentRoom = null
  connectivityStore.isOffline = false
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Watcher 3 — the metadata refresh is awaited before the rejoin reads the address', () => {
  it('rejoins with the REFRESHED hosting_url, not the stale one (fails pre-fix)', async () => {
    await setup()
    fetchMovesRoomTo(NEW_URL)

    let hostingUrlAtJoin: string | undefined
    joinRoomMock.mockImplementation(async () => {
      hostingUrlAtJoin = roomStore.currentRoom?.hosting_url
    })

    await reconnectCb!()
    await flush()

    expect(fetchRoomByIdMock).toHaveBeenCalledWith(ROOM_ID)
    expect(joinRoomMock).toHaveBeenCalled()
    // Pre-fix: fetchRoomById floated, joinRoom read the address synchronously
    // and saw OLD_URL. The refresh must land first.
    expect(hostingUrlAtJoin).toBe(NEW_URL)
  })
})

describe('rebuild path — reconnect targets the room\'s new address', () => {
  it('connects the fresh socket to the refreshed address, not the config default (fails pre-fix)', async () => {
    await setup()
    fetchMovesRoomTo(NEW_URL)

    await reconnectFailedCb!()
    await flush()

    // Pre-fix: rebuildRoomAudio called connect() with no target, silently
    // rebuilding against the instance the room was moved OFF.
    expect(connectSocketMock).toHaveBeenCalledWith(NEW_URL)
  })
})

describe('re-pin budget — a blown budget surfaces and offers retry', () => {
  it('shows the reconnect affordance instead of vanishing into the unbounded backoff (fails pre-fix)', async () => {
    vi.useFakeTimers()
    await setup()
    fetchMovesRoomTo(NEW_URL)
    joinRoomMock.mockRejectedValue(new Error('joinRoom timed out'))

    await reconnectCb!()
    await flush()

    // Surfaced: the actionable "Reconnect" toast...
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: RECONNECT_FAILED_TOAST_ID }),
    )
    // ...and NOT the silent exponential-backoff timer.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('an ordinary (non-moved) rejoin failure still uses the backoff retry — regression guard', async () => {
    vi.useFakeTimers()
    await setup()
    // fetch resolves but the pin did not change
    joinRoomMock.mockRejectedValue(new Error('joinRoom timed out'))

    await reconnectCb!()
    await flush()

    expect(vi.getTimerCount()).toBe(1)
    expect(toastAdd).not.toHaveBeenCalled()
  })
})
