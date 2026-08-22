import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import type { BootstrapRoom as Room } from '../../app/types/user/bootstrap'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
// roomSessionStore's persist config pins cookie storage explicitly (see the
// note on its `persist:` block), and that call runs at store-definition time
// — same pattern as authStore/homeFeedStore.
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

function makeRoom(id: number): Room {
  return { id, logo: `logo-${id}` } as Room
}

beforeEach(() => {
  setActivePinia(createPinia())
})

async function setup() {
  const { useRoomStore } = await import('../../app/stores/room')
  const { useRoomSessionStore } = await import('../../app/stores/roomSession')
  const roomStore = useRoomStore()
  const sessionStore = useRoomSessionStore()
  vi.stubGlobal('useRoomStore', () => roomStore)
  vi.stubGlobal('useRoomSessionStore', () => sessionStore)

  const { useRoomSession } = await import('../../app/composables/room/useRoomSession')
  const session = useRoomSession()

  return { roomStore, sessionStore, session }
}

// ============================================================
// realtime-03 — minimizedRoom snapshot (cold-start restore)
// ============================================================
describe('useRoomSession — minimizedRoom snapshot', () => {
  it('snapshots currentRoom on minimize', async () => {
    const { roomStore, sessionStore, session } = await setup()
    const room = makeRoom(1)

    session.setCurrentRoom(room)
    expect(sessionStore.minimizedRoom).toBeNull()

    session.minimizeRoom()
    expect(roomStore.isMinimized).toBe(true)
    expect(sessionStore.minimizedRoom).toEqual(room)
  })

  it('does not snapshot when there is no current room', async () => {
    const { roomStore, sessionStore, session } = await setup()

    session.minimizeRoom()
    expect(roomStore.isMinimized).toBe(false)
    expect(sessionStore.minimizedRoom).toBeNull()
  })

  it('clears the snapshot on maximize', async () => {
    const { roomStore, sessionStore, session } = await setup()

    session.setCurrentRoom(makeRoom(1))
    session.minimizeRoom()
    session.maximizeRoom()

    expect(roomStore.isMinimized).toBe(false)
    expect(sessionStore.minimizedRoom).toBeNull()
  })

  it('clears the snapshot on leave', async () => {
    const { roomStore, sessionStore, session } = await setup()

    session.setCurrentRoom(makeRoom(1))
    session.minimizeRoom()
    session.leaveRoom()

    expect(roomStore.currentRoom).toBeNull()
    expect(sessionStore.minimizedRoom).toBeNull()
  })

  it('clears a stale snapshot when entering a new room', async () => {
    const { roomStore, sessionStore, session } = await setup()

    session.setCurrentRoom(makeRoom(1))
    session.minimizeRoom()
    // Simulate cold-start restore wiped currentRoom but kept the snapshot,
    // then the user enters a fresh room.
    session.setCurrentRoom(makeRoom(2))

    expect(sessionStore.minimizedRoom).toBeNull()
    expect(roomStore.currentRoom?.id).toBe(2)
  })
})

// ============================================================
// client-session-stability — activeRoom marker lifecycle
// ============================================================
describe('useRoomSession — activeRoom marker', () => {
  it('leaveRoom nulls activeRoom', async () => {
    const { sessionStore, session } = await setup()

    session.setCurrentRoom(makeRoom(1))
    expect(sessionStore.activeRoom).not.toBeNull()

    session.leaveRoom()

    expect(sessionStore.activeRoom).toBeNull()
  })

  it('setCurrentRoom sets activeRoom {id, at}', async () => {
    const { sessionStore, session } = await setup()
    const now = Date.now()

    session.setCurrentRoom(makeRoom(5))

    expect(sessionStore.activeRoom?.id).toBe(5)
    expect(sessionStore.activeRoom?.at).toBeGreaterThanOrEqual(now)
  })

  it("setCurrentRoom(room, '/home') sets previousRoute", async () => {
    const { sessionStore, session } = await setup()

    session.setCurrentRoom(makeRoom(1), '/home')

    expect(sessionStore.previousRoute).toBe('/home')
  })

  it('touchActiveRoom refreshes `at`', async () => {
    vi.useFakeTimers()
    try {
      const { sessionStore, session } = await setup()

      session.setCurrentRoom(makeRoom(1))
      const firstAt = sessionStore.activeRoom?.at

      vi.advanceTimersByTime(1000)
      session.touchActiveRoom()

      expect(sessionStore.activeRoom?.at).toBeGreaterThan(firstAt as number)
      expect(sessionStore.activeRoom?.id).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
