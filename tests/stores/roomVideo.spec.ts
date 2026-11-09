import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { ROOM_VIDEO_CLOCK_SAMPLE_COUNT } from '../../app/constants/room'
import type { RoomVideoSnapshot, RoomVideoSource } from '../../app/types/room/video'

// Nuxt auto-imports the store relies on.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

const authUser = ref<{ id: number } | null>(null)
vi.stubGlobal('useAuthStore', () => ({
  get user() {
    return authUser.value
  },
}))

const YOUTUBE_SOURCE: RoomVideoSource = { kind: 'youtube', videoId: 'dQw4w9WgXcQ' }
const OTHER_YOUTUBE_SOURCE: RoomVideoSource = { kind: 'youtube', videoId: 'aqz-KE-bpKQ' }
const URL_SOURCE: RoomVideoSource = { kind: 'url', url: 'https://cdn.example.com/a.mp4', container: 'mp4' }

function makeSnapshot(overrides: Partial<RoomVideoSnapshot> = {}): RoomVideoSnapshot {
  return {
    controllerUserId: 7,
    source: YOUTUBE_SOURCE,
    paused: false,
    positionAtTs: 0,
    serverTs: 1_000,
    revision: 1,
    ...overrides,
  }
}

async function freshStore() {
  const { useRoomVideoStore } = await import('../../app/stores/roomVideo')
  return useRoomVideoStore()
}

beforeEach(() => {
  setActivePinia(createPinia())
  authUser.value = null
})

describe('roomVideoStore.startSession', () => {
  it('binds the room and resets session state', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot())
    store.setNeedsTap(true)
    store.setPlaybackFailed(true)
    store.addClockSample(40)

    store.startSession('room-2', true)

    expect(store.roomId).toBe('room-2')
    expect(store.enabled).toBe(true)
    expect(store.snapshot).toBeNull()
    expect(store.needsTap).toBe(false)
    expect(store.playbackFailed).toBe(false)
    expect(store.clockSamples).toEqual([])
  })

  it('records a disabled feature', async () => {
    const store = await freshStore()

    store.startSession('room-1', false)

    expect(store.roomId).toBe('room-1')
    expect(store.enabled).toBe(false)
  })

  it('keeps the Watcher-local collapsed / muted choices (only $reset drops them)', async () => {
    const store = await freshStore()
    store.setCollapsed(true)
    store.setMuted(true)

    store.startSession('room-1', true)

    expect(store.collapsed).toBe(true)
    expect(store.muted).toBe(true)
  })
})

describe('roomVideoStore.replaceSnapshot', () => {
  it('takes any revision, higher or lower than the held one', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot({ revision: 9 }))

    store.replaceSnapshot(makeSnapshot({ revision: 2 }))

    expect(store.snapshot?.revision).toBe(2)
  })

  it('null clears the snapshot', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot())

    store.replaceSnapshot(null)

    expect(store.snapshot).toBeNull()
  })
})

describe('roomVideoStore.applySnapshot', () => {
  it('drops a lower revision and reports false', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot({ revision: 5, positionAtTs: 50 }))

    const applied = store.applySnapshot(makeSnapshot({ revision: 4, positionAtTs: 99 }))

    expect(applied).toBe(false)
    expect(store.snapshot?.revision).toBe(5)
    expect(store.snapshot?.positionAtTs).toBe(50)
  })

  it('drops an EQUAL revision (a replay) and reports false', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot({ revision: 5, positionAtTs: 50 }))

    const applied = store.applySnapshot(makeSnapshot({ revision: 5, positionAtTs: 99 }))

    expect(applied).toBe(false)
    expect(store.snapshot?.positionAtTs).toBe(50)
  })

  it('applies a higher revision and reports true', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot({ revision: 5 }))

    const applied = store.applySnapshot(makeSnapshot({ revision: 6, paused: true }))

    expect(applied).toBe(true)
    expect(store.snapshot?.revision).toBe(6)
    expect(store.snapshot?.paused).toBe(true)
  })

  it('applies the first snapshot when none is held', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)

    expect(store.applySnapshot(makeSnapshot({ revision: 1 }))).toBe(true)
    expect(store.snapshot?.revision).toBe(1)
  })

  it('null always clears, and afterwards revision 1 is accepted again', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.applySnapshot(makeSnapshot({ revision: 12 }))

    expect(store.applySnapshot(null)).toBe(true)
    expect(store.snapshot).toBeNull()

    expect(store.applySnapshot(makeSnapshot({ revision: 1 }))).toBe(true)
    expect(store.snapshot?.revision).toBe(1)
  })
})

describe('roomVideoStore clock samples', () => {
  it('clockOffsetMs is 0 until a sample exists', async () => {
    const store = await freshStore()

    expect(store.clockOffsetMs).toBe(0)
  })

  it('keeps only the most recent ROOM_VIDEO_CLOCK_SAMPLE_COUNT samples, oldest first', async () => {
    const store = await freshStore()
    const total = ROOM_VIDEO_CLOCK_SAMPLE_COUNT + 3
    const samples = Array.from({ length: total }, (_, index) => index * 10)

    for (const sample of samples) store.addClockSample(sample)

    expect(store.clockSamples).toHaveLength(ROOM_VIDEO_CLOCK_SAMPLE_COUNT)
    expect(store.clockSamples).toEqual(samples.slice(-ROOM_VIDEO_CLOCK_SAMPLE_COUNT))
  })

  it('clockOffsetMs is the MAX of the held samples (the fastest packet)', async () => {
    const store = await freshStore()

    store.addClockSample(-120)
    store.addClockSample(35)
    store.addClockSample(-8)

    expect(store.clockOffsetMs).toBe(35)
  })

  it('a sample that fell out of the window no longer counts', async () => {
    const store = await freshStore()
    store.addClockSample(1_000) // the lucky old packet
    for (let i = 0; i < ROOM_VIDEO_CLOCK_SAMPLE_COUNT; i++) store.addClockSample(-50)

    expect(store.clockOffsetMs).toBe(-50)
  })
})

describe('roomVideoStore.isActive', () => {
  it('needs the feature enabled AND a snapshot', async () => {
    const store = await freshStore()

    store.startSession('room-1', false)
    store.replaceSnapshot(makeSnapshot())
    expect(store.isActive).toBe(false) // snapshot but disabled

    store.startSession('room-1', true)
    expect(store.isActive).toBe(false) // enabled but no snapshot

    store.replaceSnapshot(makeSnapshot())
    expect(store.isActive).toBe(true)
  })
})

describe('roomVideoStore.isController', () => {
  it('is true only when the signed-in user id equals controllerUserId', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot({ controllerUserId: 7 }))

    authUser.value = { id: 7 }
    expect(store.isController).toBe(true)

    authUser.value = { id: 8 }
    expect(store.isController).toBe(false)
  })

  it('is false with nobody signed in', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot({ controllerUserId: 7 }))

    authUser.value = null

    expect(store.isController).toBe(false)
  })

  it('is false when there is no snapshot', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    authUser.value = { id: 7 }

    expect(store.isController).toBe(false)
  })
})

describe('roomVideoStore playback flags', () => {
  async function flaggedStore() {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot({ revision: 1, source: YOUTUBE_SOURCE }))
    store.setNeedsTap(true)
    store.setPlaybackFailed(true)
    return store
  }

  it('are cleared when the Source changes', async () => {
    const store = await flaggedStore()

    store.applySnapshot(makeSnapshot({ revision: 2, source: OTHER_YOUTUBE_SOURCE }))

    expect(store.needsTap).toBe(false)
    expect(store.playbackFailed).toBe(false)
  })

  it('are cleared when the Source changes kind (YouTube to direct URL)', async () => {
    const store = await flaggedStore()

    store.applySnapshot(makeSnapshot({ revision: 2, source: URL_SOURCE }))

    expect(store.needsTap).toBe(false)
    expect(store.playbackFailed).toBe(false)
  })

  it('are kept when the SAME Source gets a newer revision (pause / seek)', async () => {
    const store = await flaggedStore()

    store.applySnapshot(makeSnapshot({ revision: 2, source: { ...YOUTUBE_SOURCE }, paused: true }))

    expect(store.needsTap).toBe(true)
    expect(store.playbackFailed).toBe(true)
  })

  it('are cleared when the video is taken away (null)', async () => {
    const store = await flaggedStore()

    store.applySnapshot(null)

    expect(store.needsTap).toBe(false)
    expect(store.playbackFailed).toBe(false)
  })

  it('a dropped (stale) snapshot leaves them untouched', async () => {
    const store = await flaggedStore()

    store.applySnapshot(makeSnapshot({ revision: 1, source: OTHER_YOUTUBE_SOURCE }))

    expect(store.needsTap).toBe(true)
    expect(store.playbackFailed).toBe(true)
  })
})

describe('roomVideoStore.$reset', () => {
  it('clears everything, including the Watcher-local collapsed / muted choices', async () => {
    const store = await freshStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(makeSnapshot())
    store.setCollapsed(true)
    store.setMuted(true)
    store.setNeedsTap(true)
    store.setPlaybackFailed(true)
    store.addClockSample(12)

    store.$reset()

    expect(store.roomId).toBeNull()
    expect(store.enabled).toBe(false)
    expect(store.snapshot).toBeNull()
    expect(store.collapsed).toBe(false)
    expect(store.muted).toBe(false)
    expect(store.needsTap).toBe(false)
    expect(store.playbackFailed).toBe(false)
    expect(store.clockSamples).toEqual([])
  })
})
