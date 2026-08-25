import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import type { BootstrapRoom as Room } from '../../app/types/user/bootstrap'
import { ACTIVE_ROOM_MARKER_TTL_MS } from '../../app/constants/room'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
// roomStore's persist config pins cookie storage explicitly (see the note on
// its `persist:` block), and that call runs at store-definition time — same
// pattern as authStore/homeFeedStore.
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

// ============================================================
// client-session-stability 01 — reload rehydration
//
// The defect: a full page reload nulls `currentRoom` (in-memory only), and the
// room page read an empty store as "the user left" and silently redirected.
// These tests assert the observable behaviour — does the user end up in the
// room — not how hydration was achieved.
// ============================================================

const ROOM_ID = 42

function makeRoom(id: number): Room {
  return { id, name: `room-${id}` } as Room
}

const apiMock = vi.fn()
const toastAdd = vi.fn()

vi.stubGlobal('useApi', () => ({ api: apiMock }))
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

async function setup() {
  const { useRoomStore } = await import('../../app/stores/room')
  const { useRoomSessionStore } = await import('../../app/stores/roomSession')
  const store = useRoomStore()
  const sessionStore = useRoomSessionStore()
  vi.stubGlobal('useRoomStore', () => store)
  vi.stubGlobal('useRoomSessionStore', () => sessionStore)

  const { useRoomSession } = await import('../../app/composables/room/useRoomSession')
  const roomSession = useRoomSession()
  vi.stubGlobal('useRoomSession', () => roomSession)

  const { useRoomRehydration } = await import('../../app/composables/room/useRoomRehydration')
  return { store, sessionStore, roomSession, ...useRoomRehydration() }
}

beforeEach(() => {
  setActivePinia(createPinia())
  apiMock.mockReset()
  toastAdd.mockReset()
})

describe('rehydrateFromRoute — the regression test for the silent ejection', () => {
  it('rehydrates the room when a fresh marker names it', async () => {
    const { store, roomSession, rehydrateFromRoute } = await setup()
    // Simulate the post-reload world: marker survived, currentRoom did not.
    roomSession.setCurrentRoom(makeRoom(ROOM_ID))
    store.currentRoom = null
    apiMock.mockResolvedValue({ status: 'success', data: makeRoom(ROOM_ID) })

    const handled = await rehydrateFromRoute(ROOM_ID)

    expect(handled).toBe(true)
    expect((store.currentRoom as Room | null)?.id).toBe(ROOM_ID)
  })

  it('does not rehydrate a room the user was never in (cold deep link)', async () => {
    const { store, rehydrateFromRoute } = await setup()

    const handled = await rehydrateFromRoute(ROOM_ID)

    expect(handled).toBe(false)
    expect(store.currentRoom).toBeNull()
    // A shared link must not auto-join, so nothing is even fetched.
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('does not rehydrate when the marker names a different room', async () => {
    const { store, roomSession, rehydrateFromRoute } = await setup()
    roomSession.setCurrentRoom(makeRoom(999))
    store.currentRoom = null

    const handled = await rehydrateFromRoute(ROOM_ID)

    expect(handled).toBe(false)
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('ignores a marker older than the TTL, so it can never become a stale auto-join', async () => {
    const { store, sessionStore, roomSession, rehydrateFromRoute } = await setup()
    roomSession.setCurrentRoom(makeRoom(ROOM_ID))
    store.currentRoom = null
    sessionStore.activeRoom = { id: ROOM_ID, at: Date.now() - ACTIVE_ROOM_MARKER_TTL_MS - 1 }

    const handled = await rehydrateFromRoute(ROOM_ID)

    expect(handled).toBe(false)
    expect(apiMock).not.toHaveBeenCalled()
    expect(sessionStore.activeRoom).toBeNull()
  })

  it('a genuine leave clears the marker, so a later reload does not resurrect the room', async () => {
    const { store, roomSession, rehydrateFromRoute } = await setup()
    roomSession.setCurrentRoom(makeRoom(ROOM_ID))
    roomSession.leaveRoom()

    const handled = await rehydrateFromRoute(ROOM_ID)

    expect(handled).toBe(false)
    expect(store.currentRoom).toBeNull()
  })
})

describe('rehydrateFromRoute — failure is never silent', () => {
  it('tells the user when the room no longer exists', async () => {
    const { store, sessionStore, roomSession, rehydrateFromRoute } = await setup()
    roomSession.setCurrentRoom(makeRoom(ROOM_ID))
    store.currentRoom = null
    apiMock.mockResolvedValue({ status: 'error', data: null })

    const handled = await rehydrateFromRoute(ROOM_ID)

    expect(handled).toBe(false)
    // Asserting the ABSENCE of the silent path specifically.
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(sessionStore.activeRoom).toBeNull()
  })

  it('tells the user when the fetch throws', async () => {
    const { store, roomSession, rehydrateFromRoute } = await setup()
    roomSession.setCurrentRoom(makeRoom(ROOM_ID))
    store.currentRoom = null
    apiMock.mockRejectedValue(new Error('network down'))

    const handled = await rehydrateFromRoute(ROOM_ID)

    expect(handled).toBe(false)
    expect(toastAdd).toHaveBeenCalledTimes(1)
  })
})
