// ========================================
// useRoomGiftLeaderboard Composable Tests
// ========================================
// Covers issue 05-drawer-period-totals.md:
//   - periodTotalXp seeded from period_total_xp on fetch/refresh
//   - bumpPeriodTotalXp increments the shared total regardless of active tab
//   - reset() clears the seeded total back to '0'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// useApi and onUnmounted are Nuxt/Vue auto-imports — not statically imported
// by the SUT — so stub them as globals like other composable tests do.
let apiMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  apiMock = vi.fn().mockResolvedValue({
    data: {
      period: 'daily',
      room_id: 1,
      leaderboard: [],
      period_total_xp: '150.0000',
    },
  })
  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  })
  ;(globalThis as Record<string, unknown>).onUnmounted = vi.fn()
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useApi')
  Reflect.deleteProperty(globalThis, 'onUnmounted')
})

describe('periodTotalXp seeding', () => {
  it('seeds from period_total_xp on fetch', async () => {
    const { useRoomGiftLeaderboard } = await import('~/composables/room/useRoomGiftLeaderboard')
    const { periodTotalXp, fetch } = useRoomGiftLeaderboard(1)

    await fetch(true)

    expect(periodTotalXp.value).toBe('150.0000')
  })

  it('re-seeds on refresh with the latest server value', async () => {
    const { useRoomGiftLeaderboard } = await import('~/composables/room/useRoomGiftLeaderboard')
    const { periodTotalXp, fetch, refresh } = useRoomGiftLeaderboard(1)

    await fetch(true)
    expect(periodTotalXp.value).toBe('150.0000')

    apiMock.mockResolvedValueOnce({
      data: { period: 'daily', room_id: 1, leaderboard: [], period_total_xp: '275.0000' },
    })
    await refresh()

    expect(periodTotalXp.value).toBe('275.0000')
  })

  it('reset() clears the seeded total back to 0', async () => {
    const { useRoomGiftLeaderboard } = await import('~/composables/room/useRoomGiftLeaderboard')
    const { periodTotalXp, fetch, reset } = useRoomGiftLeaderboard(1)

    await fetch(true)
    expect(periodTotalXp.value).toBe('150.0000')

    reset()
    expect(periodTotalXp.value).toBe('0')
  })
})

describe('bumpPeriodTotalXp', () => {
  it('increments the shared total visible to any composable instance', async () => {
    const { useRoomGiftLeaderboard, bumpPeriodTotalXp } = await import('~/composables/room/useRoomGiftLeaderboard')
    const { periodTotalXp, fetch } = useRoomGiftLeaderboard(1)

    await fetch(true)
    expect(periodTotalXp.value).toBe('150.0000')

    bumpPeriodTotalXp(25)

    expect(periodTotalXp.value).toBe('175')
  })

  it('applies unconditionally regardless of which tab is active — no tab-conditional logic', async () => {
    // The composable exposes no "active tab" concept for the total itself;
    // bumpPeriodTotalXp has no period parameter, proving the bump is applied
    // uniformly (daily ⊂ weekly ⊂ monthly ⊂ all-time).
    const { useRoomGiftLeaderboard, bumpPeriodTotalXp } = await import('~/composables/room/useRoomGiftLeaderboard')
    const { periodTotalXp, fetch, setPeriod } = useRoomGiftLeaderboard(1)

    await fetch(true)
    await setPeriod('monthly')

    bumpPeriodTotalXp(10)

    expect(periodTotalXp.value).toBe('160')
  })

  it('accumulates across multiple bumps', async () => {
    const { useRoomGiftLeaderboard, bumpPeriodTotalXp } = await import('~/composables/room/useRoomGiftLeaderboard')
    const { periodTotalXp, fetch } = useRoomGiftLeaderboard(1)

    await fetch(true)
    bumpPeriodTotalXp(10)
    bumpPeriodTotalXp(5.5)

    expect(periodTotalXp.value).toBe('165.5')
  })
})
