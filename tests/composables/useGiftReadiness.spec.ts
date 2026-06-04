import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Gift } from '../../app/types/gift/gift'

// ========================================
// Mocks
// ========================================

const mockIsGiftAssetCached = vi.fn()
vi.mock('~/services/giftAssetCache', () => ({
  isGiftAssetCached: (...args: unknown[]) => mockIsGiftAssetCached(...args),
}))

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  mockIsGiftAssetCached.mockReset()
})

// ========================================
// Helpers
// ========================================

function makeGift(id: number): Gift {
  return {
    id,
    name: `Gift ${id}`,
    label: null,
    description: null,
    price: 100,
    thumbnail_url: `https://cdn.example.com/thumb-${id}.png`,
    animation_url: `https://cdn.example.com/gift-${id}.mp4`,
    asset_type: 'video',
    category: 'normal',
    rarity: 'common',
    sort_order: id,
    is_critical: false,
  }
}

/** Flush pending promise microtasks. Multiple rounds cover chains of awaits. */
async function flushMicrotasks(rounds = 4) {
  for (let i = 0; i < rounds; i++) await Promise.resolve()
}

// ========================================
// AC1: readinessState is not 'ready' while no gift selected
// ========================================

describe('useGiftReadiness — idle when no gift selected', () => {
  it('readinessState is idle when selectedGift is null', async () => {
    vi.useFakeTimers()
    const { useGiftReadiness } = await import('../../app/composables/gift/useGiftReadiness')
    const selected = ref<Gift | null>(null)

    const { readinessState } = useGiftReadiness(selected)

    expect(readinessState.value).toBe('idle')
  })
})

// ========================================
// AC2: readinessState becomes 'ready' when cached
// ========================================

describe('useGiftReadiness — ready when asset is already cached', () => {
  it('readinessState becomes ready when isGiftAssetCached returns true', async () => {
    vi.useFakeTimers()
    mockIsGiftAssetCached.mockResolvedValue(true)
    const { useGiftReadiness } = await import('../../app/composables/gift/useGiftReadiness')
    const selected = ref<Gift | null>(makeGift(1))

    const { readinessState } = useGiftReadiness(selected)
    await flushMicrotasks()

    expect(readinessState.value).toBe('ready')
  })
})

// ========================================
// AC2 continued: checking → ready via polling
// ========================================

describe('useGiftReadiness — checking then ready via poll', () => {
  it('is checking while uncached, transitions to ready once poll finds the asset', async () => {
    vi.useFakeTimers()

    // First call returns false (asset not yet cached); subsequent calls return true
    mockIsGiftAssetCached
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)

    const { useGiftReadiness } = await import('../../app/composables/gift/useGiftReadiness')
    const selected = ref<Gift | null>(makeGift(2))

    const { readinessState } = useGiftReadiness(selected)

    await flushMicrotasks()
    expect(readinessState.value).toBe('checking')

    // Advance past one poll interval (POLL_MS = 200 ms) then flush
    await vi.advanceTimersByTimeAsync(200)
    await flushMicrotasks()

    expect(readinessState.value).toBe('ready')
  })
})

// ========================================
// AC3: selecting a different gift re-evaluates the gate
// ========================================

describe('useGiftReadiness — re-evaluates on gift change', () => {
  it('resets to idle then re-evaluates when selected gift changes', async () => {
    vi.useFakeTimers()

    // Gift 1: cached; Gift 2: not cached
    mockIsGiftAssetCached.mockImplementation((gift: Gift) =>
      Promise.resolve(gift.id === 1),
    )

    const { useGiftReadiness } = await import('../../app/composables/gift/useGiftReadiness')
    const selected = ref<Gift | null>(makeGift(1))

    const { readinessState } = useGiftReadiness(selected)
    await flushMicrotasks()
    expect(readinessState.value).toBe('ready')

    // Switch to gift 2 (not cached) — watch fires on next microtask, re-evaluates
    selected.value = makeGift(2)
    await flushMicrotasks()
    // Gift 2 is not cached → re-evaluation puts state in checking (not ready)
    expect(readinessState.value).toBe('checking')
  })

  it('stale generation result is ignored when gift changes mid-flight', async () => {
    vi.useFakeTimers()

    // Gift 1: slow check that we control manually
    let resolveGiftA!: (v: boolean) => void
    const giftAPromise = new Promise<boolean>(r => { resolveGiftA = r })

    // Gift 2: immediately cached
    mockIsGiftAssetCached.mockImplementationOnce(() => giftAPromise)
    mockIsGiftAssetCached.mockResolvedValue(true)

    const { useGiftReadiness } = await import('../../app/composables/gift/useGiftReadiness')
    const selected = ref<Gift | null>(makeGift(1))

    const { readinessState } = useGiftReadiness(selected)

    // Switch to gift 2 while gift 1's check is still in-flight
    selected.value = makeGift(2)
    await flushMicrotasks()
    expect(readinessState.value).toBe('ready')

    // Resolve gift 1's check late — stale generation should be ignored
    resolveGiftA(true)
    await flushMicrotasks()
    expect(readinessState.value).toBe('ready')
  })
})

// ========================================
// AC1: 10-second timeout leaves readinessState as 'error'
// ========================================

describe('useGiftReadiness — error after 10-second timeout', () => {
  it('readinessState is error after timeout expires, keeping the button disabled', async () => {
    vi.useFakeTimers()
    mockIsGiftAssetCached.mockResolvedValue(false)

    const { useGiftReadiness } = await import('../../app/composables/gift/useGiftReadiness')
    const selected = ref<Gift | null>(makeGift(3))

    const { readinessState } = useGiftReadiness(selected)
    await flushMicrotasks()
    expect(readinessState.value).toBe('checking')

    await vi.advanceTimersByTimeAsync(10_000)
    await flushMicrotasks()

    expect(readinessState.value).toBe('error')
  })
})

// ========================================
// AC4: canSend gate is independent
// ========================================
// canSend derives from useGiftEligibility (gift selected + recipients +
// quantity + balance) and is tested in useGiftEligibility.spec.ts.
// In the drawer both must be true: !canSend || !isSelectedGiftReady both
// disable the button independently — neither gate can short-circuit the other.
