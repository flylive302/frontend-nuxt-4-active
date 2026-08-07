// ========================================
// useBannerActions Composable Tests
// ========================================
//
// The defect under test: a banner whose admin-configured path is `/room/:id`
// used to be a plain <NuxtLink>, which mounted the room page with an empty
// store — blank screen, then an immediate redirect home. Room paths must now be
// intercepted and routed through the verified room-entry path instead.
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupNuxtMocks, cleanupNuxtMocks, createMockApi } from '../helpers/nuxtMocks'
import { useBannerActions } from '~/composables/events/useBannerActions'
import type { BootstrapRoom } from '~/types/user/bootstrap'

// ========================================
// Fixtures
// ========================================

function makeRoom(id: number): BootstrapRoom {
  return { id, name: `Room ${id}` } as BootstrapRoom
}

function makeEvent(): MouseEvent {
  return { preventDefault: vi.fn() } as unknown as MouseEvent
}

/** Stand-in for RouterLink's own `navigate`, obtained from its `custom` slot. */
function makeNavigate() {
  return vi.fn()
}

const toastAdd = vi.fn()
const navigateTo = vi.fn()

function setupRoomStore(currentRoom: BootstrapRoom | null = null) {
  const roomStore = { currentRoom, maximizeRoom: vi.fn() }
  ;(globalThis as Record<string, unknown>).useRoomStore = () => roomStore
  return roomStore
}

beforeEach(() => {
  toastAdd.mockClear()
  navigateTo.mockClear()
  setupNuxtMocks()
  ;(globalThis as Record<string, unknown>).useToast = () => ({ add: toastAdd })
  ;(globalThis as Record<string, unknown>).navigateTo = navigateTo
  setupRoomStore()
})

afterEach(() => {
  cleanupNuxtMocks()
  Reflect.deleteProperty(globalThis, 'useToast')
  Reflect.deleteProperty(globalThis, 'navigateTo')
  Reflect.deleteProperty(globalThis, 'useRoomStore')
})

// ========================================
// Non-room destinations
// ========================================

describe('non-room banner paths', () => {
  it.each(['/recharge', '/', '/events/summer', '/room/abc', '/room/', 'https://evil.test/room/1'])(
    'leaves %s entirely to the NuxtLink', async (path) => {
      const enterRoom = vi.fn()
      const { openBanner } = useBannerActions(enterRoom)
      const event = makeEvent()
      const navigate = makeNavigate()

      await openBanner(path, event, navigate)

      // Handed straight back to RouterLink — exactly one navigation, and the
      // link performs it (so modifier-click still opens a new tab).
      expect(navigate).toHaveBeenCalledExactlyOnceWith(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(navigateTo).not.toHaveBeenCalled()
      expect(enterRoom).not.toHaveBeenCalled()
    },
  )
})

// ========================================
// Room destinations
// ========================================

describe('room banner paths', () => {
  it('fetches the room and enters it through the verified entry path', async () => {
    const room = makeRoom(182)
    const api = createMockApi()
    api.api = vi.fn().mockResolvedValue({ status: 'success', data: room })
    setupNuxtMocks({ api })
    setupRoomStore()

    const enterRoom = vi.fn().mockResolvedValue(undefined)
    const { openBanner } = useBannerActions(enterRoom)
    const event = makeEvent()
    const navigate = makeNavigate()

    await openBanner('/room/182', event, navigate)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(api.api).toHaveBeenCalledWith('/rooms/182')
    expect(enterRoom).toHaveBeenCalledWith(room)
    // RouterLink must NOT navigate — arriving at /room/:id with an empty store
    // is the blank-screen defect. enterRoom owns the navigation.
    expect(navigate).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it.each([
    ['ctrl-click', { ctrlKey: true }],
    ['meta-click', { metaKey: true }],
    ['shift-click', { shiftKey: true }],
    ['middle-click', { button: 1 }],
  ])('leaves a room banner %s to the browser', async (_label, modifier) => {
    const api = createMockApi()
    api.api = vi.fn()
    setupNuxtMocks({ api })
    setupRoomStore()

    const event = { preventDefault: vi.fn(), ...modifier } as unknown as MouseEvent
    const navigate = makeNavigate()
    const enterRoom = vi.fn()

    await useBannerActions(enterRoom).openBanner('/room/182', event, navigate)

    // Intercepting would swallow the new tab AND enter the room in this one.
    expect(navigate).toHaveBeenCalledExactlyOnceWith(event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(api.api).not.toHaveBeenCalled()
    expect(enterRoom).not.toHaveBeenCalled()
  })

  it('accepts a trailing slash', async () => {
    const api = createMockApi()
    api.api = vi.fn().mockResolvedValue({ status: 'success', data: makeRoom(7) })
    setupNuxtMocks({ api })
    setupRoomStore()

    const enterRoom = vi.fn().mockResolvedValue(undefined)
    await useBannerActions(enterRoom).openBanner('/room/7/', makeEvent(), makeNavigate())

    expect(enterRoom).toHaveBeenCalled()
  })

  it('just restores the room when the user is already inside it', async () => {
    const api = createMockApi()
    api.api = vi.fn()
    setupNuxtMocks({ api })
    const roomStore = setupRoomStore(makeRoom(182))

    const enterRoom = vi.fn()
    await useBannerActions(enterRoom).openBanner('/room/182', makeEvent(), makeNavigate())

    // No leave/rejoin cycle — seat and audio must survive.
    expect(roomStore.maximizeRoom).toHaveBeenCalled()
    expect(navigateTo).toHaveBeenCalledWith('/room/182')
    expect(api.api).not.toHaveBeenCalled()
    expect(enterRoom).not.toHaveBeenCalled()
  })

  it('warns instead of failing silently when the room is gone', async () => {
    const api = createMockApi()
    api.api = vi.fn().mockResolvedValue({ status: 'error', data: null })
    setupNuxtMocks({ api })
    setupRoomStore()

    const enterRoom = vi.fn()
    await useBannerActions(enterRoom).openBanner('/room/999', makeEvent(), makeNavigate())

    expect(enterRoom).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('warns when the lookup throws', async () => {
    const api = createMockApi()
    api.api = vi.fn().mockRejectedValue(new Error('offline'))
    setupNuxtMocks({ api })
    setupRoomStore()

    const enterRoom = vi.fn()
    await useBannerActions(enterRoom).openBanner('/room/5', makeEvent(), makeNavigate())

    expect(enterRoom).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('ignores a second click while an entry is in flight', async () => {
    const api = createMockApi()
    let release: (value: unknown) => void = () => {}
    api.api = vi.fn().mockReturnValue(new Promise((resolve) => { release = resolve }))
    setupNuxtMocks({ api })
    setupRoomStore()

    const enterRoom = vi.fn().mockResolvedValue(undefined)
    const { openBanner } = useBannerActions(enterRoom)

    const first = openBanner('/room/182', makeEvent(), makeNavigate())
    await openBanner('/room/182', makeEvent(), makeNavigate())

    expect(api.api).toHaveBeenCalledTimes(1)

    release({ status: 'success', data: makeRoom(182) })
    await first
    expect(enterRoom).toHaveBeenCalledTimes(1)
  })
})
