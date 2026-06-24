import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import type { BootstrapRoom as Room } from '../../app/types/user/bootstrap'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

function makeRoom(id: number): Room {
  return { id, logo: `logo-${id}` } as Room
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// ============================================================
// realtime-03 — minimizedRoom snapshot (cold-start restore)
// ============================================================
describe('roomStore.minimizedRoom snapshot', () => {
  it('snapshots currentRoom on minimize', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()
    const room = makeRoom(1)

    store.setCurrentRoom(room)
    expect(store.minimizedRoom).toBeNull()

    store.minimizeRoom()
    expect(store.isMinimized).toBe(true)
    expect(store.minimizedRoom).toEqual(room)
  })

  it('does not snapshot when there is no current room', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()

    store.minimizeRoom()
    expect(store.isMinimized).toBe(false)
    expect(store.minimizedRoom).toBeNull()
  })

  it('clears the snapshot on maximize', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()

    store.setCurrentRoom(makeRoom(1))
    store.minimizeRoom()
    store.maximizeRoom()

    expect(store.isMinimized).toBe(false)
    expect(store.minimizedRoom).toBeNull()
  })

  it('clears the snapshot on leave', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()

    store.setCurrentRoom(makeRoom(1))
    store.minimizeRoom()
    store.leaveRoom()

    expect(store.currentRoom).toBeNull()
    expect(store.minimizedRoom).toBeNull()
  })

  it('clears a stale snapshot when entering a new room', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()

    store.setCurrentRoom(makeRoom(1))
    store.minimizeRoom()
    // Simulate cold-start restore wiped currentRoom but kept the snapshot,
    // then the user enters a fresh room.
    store.setCurrentRoom(makeRoom(2))

    expect(store.minimizedRoom).toBeNull()
    expect(store.currentRoom?.id).toBe(2)
  })
})
