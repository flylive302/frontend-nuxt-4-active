import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, nextTick, ref, watch, type EffectScope, type Ref } from 'vue'
import type { CpSeatedCouple } from '~/utils/cp-bind-fx'
import { CP_BIND_FX_GIFT_ID, CP_BIND_FX_LEFT_AVATAR_KEY, CP_BIND_FX_LEFT_NAME_KEY, CP_BIND_FX_RIGHT_NAME_KEY } from '~/constants/cp-event'

const { preloadGift, resolveSvgaPlugin } = vi.hoisted(() => ({
  preloadGift: vi.fn(() => Promise.resolve()),
  resolveSvgaPlugin: vi.fn(() => null),
}))

vi.mock('~/services/giftAssetCache', () => ({ preloadGift }))
vi.mock('~/composables/gift/useSvgaPlugin', () => ({ resolveSvgaPlugin }))
vi.mock('~/services/motionPauseOrchestrator', () => ({ isAway: () => false }))

const A = 1
const B = 2
const C = 3

const pair = (l: number, r: number): CpSeatedCouple => ({ leftUserId: l, rightUserId: r })

async function setup() {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  setActivePinia(createPinia())
  const { useGiftStore } = await import('~/stores/gift')
  const { useRoomSeatsStore } = await import('~/stores/roomSeats')
  const { useRoomParticipantsStore } = await import('~/stores/roomParticipants')
  const { useRoomStore } = await import('~/stores/room')
  const giftStore = useGiftStore()
  const seatsStore = useRoomSeatsStore()
  const participantsStore = useRoomParticipantsStore()
  const roomStore = useRoomStore()
  vi.stubGlobal('useGiftStore', () => giftStore)
  vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
  vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)
  vi.stubGlobal('useRoomStore', () => roomStore)

  participantsStore.addParticipant({ id: A, name: 'Lia', avatar: 'https://cdn.example.com/a.jpg' } as never)
  participantsStore.addParticipant({ id: B, name: 'Ravi', avatar: 'https://cdn.example.com/b.jpg' } as never)

  const enqueue = vi.spyOn(giftStore, 'enqueuePlayback').mockImplementation(() => {})

  const couples: Ref<readonly CpSeatedCouple[]> = ref([])
  const pairsSynced = ref(false)
  const hasSeatedPairs = ref(false)

  const { useCpBindFx } = await import('~/composables/room/useCpBindFx')
  const scope: EffectScope = effectScope()
  scope.run(() => useCpBindFx({ couples, pairsSynced, hasSeatedPairs }))

  return { scope, enqueue, seatsStore, roomStore, couples, pairsSynced, hasSeatedPairs }
}

let scope: EffectScope | undefined

beforeEach(() => {
  preloadGift.mockClear()
})

afterEach(() => {
  scope?.stop()
  scope = undefined
  vi.unstubAllGlobals()
})

async function armed() {
  const ctx = await setup()
  scope = ctx.scope
  ctx.seatsStore.setSeatsHydrated(true)
  ctx.pairsSynced.value = true
  await nextTick()
  return ctx
}

describe('useCpBindFx', () => {
  it('plays nothing while seats are not hydrated', async () => {
    const ctx = await setup()
    scope = ctx.scope
    ctx.pairsSynced.value = true
    ctx.couples.value = [pair(A, B)]
    await nextTick()
    ctx.couples.value = [pair(A, B), pair(B, C)]
    await nextTick()
    expect(ctx.enqueue).not.toHaveBeenCalled()
  })

  it('treats couples present at arming as baseline (late joiner)', async () => {
    const ctx = await setup()
    scope = ctx.scope
    ctx.seatsStore.setSeatsHydrated(true)
    ctx.couples.value = [pair(A, B)]
    await nextTick()
    expect(ctx.enqueue).not.toHaveBeenCalled()

    ctx.pairsSynced.value = true
    await nextTick()
    expect(ctx.enqueue).not.toHaveBeenCalled()

    ctx.couples.value = [pair(A, B)]
    await nextTick()
    expect(ctx.enqueue).not.toHaveBeenCalled()
  })

  it('plays a personalized center animation for a new couple', async () => {
    const ctx = await armed()
    ctx.couples.value = [pair(A, B)]
    await nextTick()

    expect(ctx.enqueue).toHaveBeenCalledTimes(1)
    const arg = ctx.enqueue.mock.calls[0]![0]
    expect(arg.senderId).toBe(A)
    expect(arg.recipientIds).toEqual([B])
    expect(arg.gift.is_critical).toBe(true)
    expect(arg.gift.id).toBe(CP_BIND_FX_GIFT_ID)
    expect(arg.svgaFills?.texts?.[CP_BIND_FX_LEFT_NAME_KEY]).toBe('Lia')
    expect(arg.svgaFills?.texts?.[CP_BIND_FX_RIGHT_NAME_KEY]).toBe('Ravi')
    expect(arg.svgaFills?.images?.[CP_BIND_FX_LEFT_AVATAR_KEY]).toBeTruthy()
  })

  it('plays again after sit, stand, sit', async () => {
    const ctx = await armed()
    ctx.couples.value = [pair(A, B)]
    await nextTick()
    ctx.couples.value = []
    await nextTick()
    ctx.couples.value = [pair(A, B)]
    await nextTick()
    expect(ctx.enqueue).toHaveBeenCalledTimes(2)
  })

  it('does not replay when the same couple swaps sides', async () => {
    const ctx = await armed()
    ctx.couples.value = [pair(A, B)]
    await nextTick()
    ctx.couples.value = [pair(B, A)]
    await nextTick()
    expect(ctx.enqueue).toHaveBeenCalledTimes(1)
  })

  it('disarms on seat reset so the next room gets a fresh baseline', async () => {
    const ctx = await armed()
    ctx.seatsStore.setSeatsHydrated(false)
    ctx.pairsSynced.value = false
    ctx.couples.value = []
    await nextTick()

    ctx.seatsStore.setSeatsHydrated(true)
    ctx.couples.value = [pair(A, B)]
    ctx.pairsSynced.value = true
    await nextTick()
    expect(ctx.enqueue).not.toHaveBeenCalled()
  })

  it('skips playback while the room is minimized', async () => {
    const ctx = await armed()
    ctx.roomStore.setMinimized(true)
    ctx.couples.value = [pair(A, B)]
    await nextTick()
    expect(ctx.enqueue).not.toHaveBeenCalled()
  })

  it('preloads the asset once a CP pair is seated', async () => {
    const ctx = await setup()
    scope = ctx.scope
    expect(preloadGift).not.toHaveBeenCalled()
    ctx.hasSeatedPairs.value = true
    await nextTick()
    expect(preloadGift).toHaveBeenCalledTimes(1)
  })
})
