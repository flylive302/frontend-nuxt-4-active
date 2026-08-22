import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import type { BootstrapRoom as Room } from '../../app/types/user/bootstrap'

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

function makeRoom(id: number): Room {
  return { id, logo: `logo-${id}` } as Room
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// ============================================================
// daily-room-xp 03 — live daily XP optimistic bump
// ============================================================
describe('roomStore.bumpDailyXp', () => {
  it('seeds daily_xp from the room payload on join', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()
    const room = { ...makeRoom(1), daily_xp: '250' }

    store.setCurrentRoom(room)

    expect(store.currentRoom?.daily_xp).toBe('250')
  })

  it('adds the amount on top of the existing daily_xp', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()
    store.setCurrentRoom({ ...makeRoom(1), daily_xp: '100' })

    store.bumpDailyXp(30)

    expect(store.currentRoom?.daily_xp).toBe('130')
  })

  it('treats a missing/empty daily_xp as zero', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()
    store.setCurrentRoom(makeRoom(1))

    store.bumpDailyXp(42)

    expect(store.currentRoom?.daily_xp).toBe('42')
  })

  it('does not mutate lifetime room_xp', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()
    store.setCurrentRoom({ ...makeRoom(1), room_xp: '500', daily_xp: '100' })

    store.bumpDailyXp(30)

    expect(store.currentRoom?.room_xp).toBe('500')
    expect(store.currentRoom?.daily_xp).toBe('130')
  })

  it('is a no-op with no current room', async () => {
    const { useRoomStore } = await import('../../app/stores/room')
    const store = useRoomStore()

    expect(() => store.bumpDailyXp(10)).not.toThrow()
    expect(store.currentRoom).toBeNull()
  })
})
