import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue'
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

// mic-fgs-crash 02: visibility is CONTROLLABLE, not pinned.
// Before this it was `() => ref('visible')`, so Watcher 4 (PWA/mobile resume)
// had no test in the suite that exercised a visibility change through it. The
// composable reads visibility through this vueuse composable, so promoting the
// existing mock to a shared ref is the seam — a hand-rolled fake `document`
// (the motion-pause spec's shape) would never be consulted by this watcher.
const visibilityState = ref<'visible' | 'hidden'>('visible')

vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => visibilityState,
  useEventListener: vi.fn(),
  useIntervalFn: vi.fn(),
}))

/** Drive a hidden → visible transition and let the watcher's sync half run. */
async function foregroundApp() {
  visibilityState.value = 'hidden'
  await flush()
  visibilityState.value = 'visible'
  await flush()
}

const OLD_URL = 'https://msab-old.audio.flyliveapp.com'
const NEW_URL = 'https://msab-new.audio.flyliveapp.com'
const ROOM_ID = 7

type FakeRoom = { id: number; hosting_url: string }

// --- collaborator mocks, re-wired per test in setup() ---
let reconnectCb: (() => Promise<void> | void) | null = null
let reconnectFailedCb: (() => Promise<void> | void) | null = null

const joinRoomMock = vi.fn()
const drainPendingMicReclaimMock = vi.fn()
const probeAudioHealthMock = vi.fn()
/** Call order across the resume path, so D4's ordering is asserted directly. */
let resumeCalls: string[] = []
const leaveRoomMock = vi.fn()
const connectSocketMock = vi.fn()
const disconnectSocketMock = vi.fn()
const fetchRoomByIdMock = vi.fn()
const toastAdd = vi.fn()
const toastRemove = vi.fn()

const roomStore = reactive({
  currentRoom: null as FakeRoom | null,
  isMinimized: false,
})

const roomSessionStore = reactive({
  previousRoute: null as string | null,
})

const roomSessionLeaveRoom = vi.fn()
const roomSessionTouchActiveRoom = vi.fn()

const connectivityStore = reactive({ isOffline: false, restoredAt: 0 })

vi.stubGlobal('useRoomStore', () => roomStore)
vi.stubGlobal('useRoomSessionStore', () => roomSessionStore)
vi.stubGlobal('useRoomSession', () => ({
  leaveRoom: roomSessionLeaveRoom,
  touchActiveRoom: roomSessionTouchActiveRoom,
  setCurrentRoom: vi.fn(),
  minimizeRoom: vi.fn(),
  maximizeRoom: vi.fn(),
  clearActiveRoom: vi.fn(),
}))
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
  probeAudioHealth: probeAudioHealthMock,
  drainPendingMicReclaim: drainPendingMicReclaimMock,
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

/**
 * Scope owning the watchers `useRoomLifecycle()` registers, so each test's
 * watchers die with it. Without this every `setup()` left its watchers alive on
 * the shared module refs, and by the Nth test one visibility flip fired N
 * handlers — which made any call-count assertion measure the leak, not the code.
 */
let lifecycleScope: ReturnType<typeof effectScope> | null = null

async function setup() {
  roomStore.currentRoom = { id: ROOM_ID, hosting_url: OLD_URL }
  const { useRoomLifecycle } = await import('../../app/composables/room/useRoomLifecycle')
  lifecycleScope = effectScope()
  lifecycleScope.run(() => { useRoomLifecycle() })
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
  roomSessionStore.previousRoute = null
  roomSessionLeaveRoom.mockReset()
  roomSessionTouchActiveRoom.mockReset()
  connectivityStore.isOffline = false
  visibilityState.value = 'visible'
  resumeCalls = []
  drainPendingMicReclaimMock.mockReset().mockImplementation(async () => {
    resumeCalls.push('drain')
  })
  probeAudioHealthMock.mockReset().mockImplementation(async () => {
    resumeCalls.push('probe')
    return 'healthy'
  })
})

afterEach(() => {
  lifecycleScope?.stop()
  lifecycleScope = null
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

// ============================================================
// mic-fgs-crash 02 / spec D4 — the drain runs BEFORE the audio-health probe.
//
// This is the single most likely thing to get wrong, and getting it wrong
// produces a fix that looks correct and does nothing: the probe guards every
// producer check behind "is there a producer", so with the producer
// deliberately deferred it reports HEALTHY and the resume handler returns
// early. A drain placed after it never runs.
//
// The placement is above the watcher's `isRecovering` / `isJoining` guards too,
// because the very paths that DEFER a re-claim are the ones holding those
// guards — see the comment at the top of Watcher 4.
// ============================================================
describe('Watcher 4 — a deferred mic re-claim is settled on resume', () => {
  it('drains the pending re-claim BEFORE probing audio health (fails if the drain moves below the probe)', async () => {
    await setup()

    await foregroundApp()

    // Ordering, asserted at the point it matters: the drain has already run and
    // the probe has not been reached yet. Both are awaited in program order, so
    // this is a guarantee rather than a timer race.
    expect(drainPendingMicReclaimMock).toHaveBeenCalledTimes(1)
    expect(probeAudioHealthMock).not.toHaveBeenCalled()
    expect(resumeCalls).toEqual(['drain'])
  })

  it('still drains while a rejoin is in flight — the case that CREATES the pending re-claim', async () => {
    await setup()

    // Watcher 3 holds `isJoining` for the whole rejoin. That rejoin is exactly
    // what defers the re-claim while the app is hidden, and users foreground the
    // app during it. A drain below the guards would return without running and
    // leave a silent Speaker.
    // Typed with a no-op initializer, not `| null`: TS's control-flow analysis
    // cannot see the assignment inside the executor and narrows a null-initialised
    // binding to `never` at the call site.
    let releaseJoin: () => void = () => {}
    joinRoomMock.mockImplementation(() => new Promise<void>((resolve) => {
      releaseJoin = resolve
    }))

    void reconnectCb!()
    await flush()

    await foregroundApp()

    expect(drainPendingMicReclaimMock).toHaveBeenCalledTimes(1)

    releaseJoin()
    await flush()
  })

  it('still drains while a reconnect-failed rebuild holds isRecovering', async () => {
    await setup()

    // The other half of the guard pair. `onReconnectFailed` (and the
    // transport-exhausted path) hold `isRecovering` across a full rebuild, and
    // that rebuild's rejoin is another route that defers a re-claim. A drain
    // below the guards would silently skip here too.
    let releaseConnect: () => void = () => {}
    connectSocketMock.mockImplementation(() => new Promise<void>((resolve) => {
      releaseConnect = resolve
    }))

    void reconnectFailedCb!()
    await flush()

    await foregroundApp()

    expect(drainPendingMicReclaimMock).toHaveBeenCalledTimes(1)

    releaseConnect()
    await flush()
  })

  it('does not run on a visible → hidden transition — backgrounding settles nothing', async () => {
    await setup()

    visibilityState.value = 'hidden'
    await flush()

    expect(drainPendingMicReclaimMock).not.toHaveBeenCalled()
  })
})
