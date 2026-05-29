import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import { vi } from 'vitest'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

describe('useLuckySessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('addFloater appends an entry to floatingMultipliers', async () => {
    const { useLuckySessionStore } = await import('../../app/stores/luckySession')
    const store = useLuckySessionStore()

    store.addFloater({ id: 1, multiplier: 2.5, colorClass: 'lucky-float--great' })

    expect(store.floatingMultipliers).toHaveLength(1)
    expect(store.floatingMultipliers[0]).toEqual({ id: 1, multiplier: 2.5, colorClass: 'lucky-float--great' })
  })

  it('$reset clears floatingMultipliers and all announcement refs', async () => {
    const { useLuckySessionStore } = await import('../../app/stores/luckySession')
    const store = useLuckySessionStore()

    store.addFloater({ id: 1, multiplier: 5, colorClass: 'lucky-float--epic' })
    store.setRoomAnnouncement({
      user_id: 1,
      user_name: 'Alice',
      user_avatar: 'a.png',
      multiplier: 5,
      coins_won: 500,
      tier_name: 'Epic',
      room_name: 'Room A',
      svga_url: 'room.svga',
    })
    store.setAppAnnouncement({
      user_id: 2,
      user_name: 'Bob',
      user_avatar: 'b.png',
      multiplier: 50,
      coins_won: 5000,
      tier_name: 'Mega',
      room_id: 99,
      room_name: 'Room B',
      svga_url: 'app.svga',
    })

    store.$reset()

    expect(store.floatingMultipliers).toHaveLength(0)
    expect(store.roomAnnouncement).toBeNull()
    expect(store.isRoomAnnouncementVisible).toBe(false)
    expect(store.appAnnouncement).toBeNull()
    expect(store.isAppAnnouncementVisible).toBe(false)
  })
})
