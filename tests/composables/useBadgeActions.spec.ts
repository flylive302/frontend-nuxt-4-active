// ========================================
// useBadgeActions Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
} from '../helpers/nuxtMocks'
import { buildArrangement } from '~/composables/progression/useBadgeActions'
import type { EquippedBadge, UserBadge } from '~/types/progression/badge'

// Hoist mock socket emit so it's accessible in both vi.mock factory and test assertions
const mockEmit = vi.hoisted(() => vi.fn())

// Mock useAudioSocket so audioSocketRef appears connected — avoids the circular
// composable chain (useProfileActions → useAudioSocket → useRealtimeEvents → …)
// that would overflow the call stack.
vi.mock('~/composables/room/useAudioSocket', async () => {
  const { ref } = await import('vue')
  return {
    audioSocketRef: ref({ connected: true, emit: mockEmit }),
  }
})

// Mock logger
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

// ========================================
// Fixtures
// ========================================

function makeUserBadge(userBadgeId: number, badgeId: number, status: 'active' | 'expired' = 'active'): UserBadge {
  return {
    id: userBadgeId,
    badge: { id: badgeId, name: `Badge ${badgeId}`, description: '', image_url: `https://cdn/b${badgeId}.png` },
    earned_at: '2024-01-01T00:00:00Z',
    source_type: 'achievement',
    status,
    active_count: status === 'active' ? 1 : 0,
    expires_at: null,
    days_remaining: null,
  }
}

function makeEquipped(slotPosition: number, badgeId: number): EquippedBadge {
  return { slot_position: slotPosition, badge_id: badgeId, image_url: `https://cdn/b${badgeId}.png` }
}

// ========================================
// Mock Factories
// ========================================

function createMockBadgesStore(overrides: Record<string, unknown> = {}) {
  const userBadgesItems = [
    makeUserBadge(1, 10),
    makeUserBadge(2, 20),
  ]
  return {
    userBadges: {
      items: userBadgesItems,
    },
    catalog: { items: [] },
    equippedBadges: [] as EquippedBadge[],
    badgeSlotLimit: 6,
    stats: { total: 2 },
    addUserBadge: vi.fn(),
    incrementStatsTotal: vi.fn(),
    setEquippedBadges: vi.fn(),
    isUserBadgeValid: (badgeId: number) =>
      userBadgesItems.some(ub => ub.badge.id === badgeId && ub.status === 'active'),
    ...overrides,
  }
}

function createMockToast() {
  return { add: vi.fn() }
}

function createMockApi(resolveWith?: unknown, rejectWith?: Error) {
  return {
    api: rejectWith
      ? vi.fn().mockRejectedValue(rejectWith)
      : vi.fn().mockResolvedValue({ data: resolveWith ?? [] }),
    normalizeError: vi.fn((e: { message?: string }) => ({
      message: e?.message ?? 'Unknown error',
    })),
  }
}

// ========================================
// Test State
// ========================================

let useBadgeActions: () => ReturnType<typeof import('~/composables/progression/useBadgeActions')['useBadgeActions']>
let badgesStore: ReturnType<typeof createMockBadgesStore>
let mockToast: ReturnType<typeof createMockToast>
let mockApiModule: ReturnType<typeof createMockApi>

beforeEach(async () => {
  badgesStore = createMockBadgesStore()
  mockToast = createMockToast()
  mockApiModule = createMockApi()
  mockEmit.mockClear()

  setupNuxtMocks({})
  ;(globalThis as Record<string, unknown>).useBadgesStore = () => badgesStore
  ;(globalThis as Record<string, unknown>).useToast = () => mockToast
  ;(globalThis as Record<string, unknown>).useApi = () => mockApiModule

  const mod = await import('~/composables/progression/useBadgeActions')
  useBadgeActions = mod.useBadgeActions
})

afterEach(() => {
  cleanupNuxtMocks()
  Reflect.deleteProperty(globalThis, 'useBadgesStore')
  Reflect.deleteProperty(globalThis, 'useToast')
  Reflect.deleteProperty(globalThis, 'useApi')
  vi.restoreAllMocks()
})

// ========================================
// buildArrangement (pure helper)
// ========================================

describe('buildArrangement', () => {
  it('equip: adds a new badge into an empty slot', () => {
    const current: EquippedBadge[] = [makeEquipped(1, 10)]
    const result = buildArrangement(current, { type: 'equip', slotPosition: 2, badgeId: 20, imageUrl: null })
    expect(result).toHaveLength(2)
    expect(result.find(e => e.slot_position === 2)?.badge_id).toBe(20)
  })

  it('equip: replaces an existing badge in the same slot', () => {
    const current = [makeEquipped(1, 10)]
    const result = buildArrangement(current, { type: 'equip', slotPosition: 1, badgeId: 20, imageUrl: null })
    expect(result).toHaveLength(1)
    expect(result[0]!.badge_id).toBe(20)
  })

  it('equip: moves a badge already in another slot to the new position (no duplicates)', () => {
    const current = [makeEquipped(1, 10), makeEquipped(2, 20)]
    // Badge 10 is in slot 1; equip badge 10 into slot 3 should remove it from slot 1
    const result = buildArrangement(current, { type: 'equip', slotPosition: 3, badgeId: 10, imageUrl: null })
    expect(result.some(e => e.slot_position === 1)).toBe(false)
    expect(result.find(e => e.slot_position === 3)?.badge_id).toBe(10)
  })

  it('unequip: removes the badge at the given slot', () => {
    const current = [makeEquipped(1, 10), makeEquipped(2, 20)]
    const result = buildArrangement(current, { type: 'unequip', slotPosition: 1 })
    expect(result).toHaveLength(1)
    expect(result[0]!.slot_position).toBe(2)
  })

  it('unequip: returns unchanged array when slot is empty', () => {
    const current = [makeEquipped(2, 20)]
    const result = buildArrangement(current, { type: 'unequip', slotPosition: 1 })
    expect(result).toHaveLength(1)
  })

  it('reorder: swaps badge_ids between two occupied slots', () => {
    const current = [makeEquipped(1, 10), makeEquipped(2, 20)]
    const result = buildArrangement(current, { type: 'reorder', fromSlot: 1, toSlot: 2 })
    expect(result.find(e => e.slot_position === 1)?.badge_id).toBe(20)
    expect(result.find(e => e.slot_position === 2)?.badge_id).toBe(10)
  })
})

// ========================================
// useBadgeActions — onBadgeEarned
// ========================================

describe('onBadgeEarned', () => {
  it('adds badge to store and increments stats', () => {
    const badge = makeUserBadge(3, 30)
    const { onBadgeEarned } = useBadgeActions()
    onBadgeEarned(badge)
    expect(badgesStore.addUserBadge).toHaveBeenCalledWith(badge)
    expect(badgesStore.incrementStatsTotal).toHaveBeenCalled()
  })

  it('shows success toast with badge name', () => {
    const badge = makeUserBadge(3, 30)
    badge.badge.name = 'Gold Star'
    const { onBadgeEarned } = useBadgeActions()
    onBadgeEarned(badge)
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Badge Earned!', description: 'Gold Star', color: 'success' }),
    )
  })
})

// ========================================
// useBadgeActions — equip
// ========================================

describe('equip', () => {
  it('optimistically updates the store, then settles with server response', async () => {
    const serverResponse = [makeEquipped(1, 10)]
    mockApiModule.api.mockResolvedValue({ data: serverResponse })

    const { equip } = useBadgeActions()
    await equip(1, 10)

    // Optimistic call first
    expect(badgesStore.setEquippedBadges).toHaveBeenCalledTimes(2)
    // Final settle matches server response
    expect(badgesStore.setEquippedBadges).toHaveBeenLastCalledWith(serverResponse)
  })

  it('sends PUT /user/equipped-badges with the new arrangement', async () => {
    const { equip } = useBadgeActions()
    await equip(2, 10)

    expect(mockApiModule.api).toHaveBeenCalledWith('/user/equipped-badges', expect.objectContaining({
      method: 'PUT',
    }))
    const body = (mockApiModule.api.mock.calls[0] as [string, { body: unknown }])[1]?.body as Array<{ slot_position: number; badge_id: number }>
    expect(body.find(e => e.slot_position === 2 && e.badge_id === 10)).toBeTruthy()
  })

  it('rolls back and shows error toast on API failure', async () => {
    const snapshot = [makeEquipped(1, 20)]
    badgesStore.equippedBadges = [...snapshot]
    mockApiModule.api.mockRejectedValue(new Error('Server error'))

    const { equip } = useBadgeActions()
    await equip(2, 10)

    // Last setEquippedBadges call = rollback to snapshot
    const lastCall = badgesStore.setEquippedBadges.mock.calls.at(-1) as [EquippedBadge[]]
    expect(lastCall[0]).toEqual(snapshot)

    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'error' }),
    )
  })

  it('does nothing when badge is not owned', async () => {
    const { equip } = useBadgeActions()
    await equip(1, 999) // badge 999 not in userBadges

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('does nothing when slot exceeds badge slot limit', async () => {
    const { equip } = useBadgeActions()
    await equip(99, 10) // slot 99 > badgeSlotLimit (6)

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('GATE: rejects equipping an expired badge with a toast before any API call', async () => {
    badgesStore = createMockBadgesStore({
      userBadges: { items: [makeUserBadge(1, 10, 'expired'), makeUserBadge(2, 20)] },
      isUserBadgeValid: (badgeId: number) => badgeId === 20,
    });
    (globalThis as Record<string, unknown>).useBadgesStore = () => badgesStore

    const { equip } = useBadgeActions()
    await equip(1, 10)

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Badge expired', color: 'error' }),
    )
  })

  it('equipped badge disappears from available list (not in equippedBadges anymore as grid excludes it)', async () => {
    const serverResponse = [makeEquipped(1, 10)]
    mockApiModule.api.mockResolvedValue({ data: serverResponse })

    const { equip } = useBadgeActions()
    await equip(1, 10)

    // equippedBadges is updated — assembleBadgeCatalog will exclude badge 10 from the grid
    const settled = badgesStore.setEquippedBadges.mock.calls.at(-1) as [EquippedBadge[]]
    expect(settled[0].some(e => e.badge_id === 10)).toBe(true)
  })
})

// ========================================
// useBadgeActions — unequip
// ========================================

describe('unequip', () => {
  it('removes the badge from the equipped list and sends PUT', async () => {
    badgesStore.equippedBadges = [makeEquipped(1, 10), makeEquipped(2, 20)]
    const serverResponse = [makeEquipped(2, 20)]
    mockApiModule.api.mockResolvedValue({ data: serverResponse })

    const { unequip } = useBadgeActions()
    await unequip(1)

    expect(mockApiModule.api).toHaveBeenCalledWith('/user/equipped-badges', expect.objectContaining({ method: 'PUT' }))
    const settled = badgesStore.setEquippedBadges.mock.calls.at(-1) as [EquippedBadge[]]
    expect(settled[0]).toEqual(serverResponse)
  })

  it('unequipped badge reappears in available list (equippedBadges no longer contains it)', async () => {
    badgesStore.equippedBadges = [makeEquipped(1, 10)]
    const serverResponse: EquippedBadge[] = []
    mockApiModule.api.mockResolvedValue({ data: serverResponse })

    const { unequip } = useBadgeActions()
    await unequip(1)

    const settled = badgesStore.setEquippedBadges.mock.calls.at(-1) as [EquippedBadge[]]
    expect(settled[0].some(e => e.badge_id === 10)).toBe(false)
  })

  it('rolls back and shows error toast on API failure', async () => {
    const snapshot = [makeEquipped(1, 10)]
    badgesStore.equippedBadges = [...snapshot]
    mockApiModule.api.mockRejectedValue(new Error('Network error'))

    const { unequip } = useBadgeActions()
    await unequip(1)

    const lastCall = badgesStore.setEquippedBadges.mock.calls.at(-1) as [EquippedBadge[]]
    expect(lastCall[0]).toEqual(snapshot)
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('does nothing when slot is empty', async () => {
    badgesStore.equippedBadges = [] // no badges equipped
    const { unequip } = useBadgeActions()
    await unequip(1)
    expect(mockApiModule.api).not.toHaveBeenCalled()
  })
})

// ========================================
// useBadgeActions — reorder
// ========================================

describe('reorder', () => {
  it('swaps slot positions and sends PUT before API resolves (optimistic)', async () => {
    badgesStore.equippedBadges = [makeEquipped(1, 10), makeEquipped(2, 20)]
    mockApiModule.api.mockResolvedValue({ data: [makeEquipped(1, 20), makeEquipped(2, 10)] })

    const { reorder } = useBadgeActions()
    await reorder(1, 2)

    // First setEquippedBadges = optimistic (swapped positions)
    const optimistic = badgesStore.setEquippedBadges.mock.calls[0] as [EquippedBadge[]]
    expect(optimistic[0].find(e => e.slot_position === 1)?.badge_id).toBe(20)
    expect(optimistic[0].find(e => e.slot_position === 2)?.badge_id).toBe(10)

    expect(mockApiModule.api).toHaveBeenCalledWith('/user/equipped-badges', expect.objectContaining({ method: 'PUT' }))
  })

  it('rolls back on failure', async () => {
    const snapshot = [makeEquipped(1, 10), makeEquipped(2, 20)]
    badgesStore.equippedBadges = [...snapshot]
    mockApiModule.api.mockRejectedValue(new Error('fail'))

    const { reorder } = useBadgeActions()
    await reorder(1, 2)

    const lastCall = badgesStore.setEquippedBadges.mock.calls.at(-1) as [EquippedBadge[]]
    expect(lastCall[0]).toEqual(snapshot)
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('does nothing when either slot is empty', async () => {
    badgesStore.equippedBadges = [makeEquipped(1, 10)] // slot 2 empty
    const { reorder } = useBadgeActions()
    await reorder(1, 2)
    expect(mockApiModule.api).not.toHaveBeenCalled()
  })
})

// ========================================
// emitProfileSync — live propagation (badge-10)
// ========================================

describe('emitProfileSync on mutation', () => {
  it('emits equipped_badges with the server-settled array on equip success', async () => {
    const serverResponse = [makeEquipped(1, 10)]
    mockApiModule.api.mockResolvedValue({ data: serverResponse })

    const { equip } = useBadgeActions()
    await equip(1, 10)

    expect(mockEmit).toHaveBeenCalledOnce()
    expect(mockEmit).toHaveBeenCalledWith('user:profileSync', { profile: { equipped_badges: serverResponse } })
  })

  it('does not emit on equip failure (rollback path)', async () => {
    badgesStore.equippedBadges = [makeEquipped(1, 20)]
    mockApiModule.api.mockRejectedValue(new Error('Server error'))

    const { equip } = useBadgeActions()
    await equip(2, 10)

    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('emits equipped_badges with the server-settled array on unequip success', async () => {
    badgesStore.equippedBadges = [makeEquipped(1, 10)]
    const serverResponse: EquippedBadge[] = []
    mockApiModule.api.mockResolvedValue({ data: serverResponse })

    const { unequip } = useBadgeActions()
    await unequip(1)

    expect(mockEmit).toHaveBeenCalledOnce()
    expect(mockEmit).toHaveBeenCalledWith('user:profileSync', { profile: { equipped_badges: serverResponse } })
  })

  it('does not emit on unequip failure (rollback path)', async () => {
    badgesStore.equippedBadges = [makeEquipped(1, 10)]
    mockApiModule.api.mockRejectedValue(new Error('Network error'))

    const { unequip } = useBadgeActions()
    await unequip(1)

    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('emits equipped_badges with the server-settled array on reorder success', async () => {
    badgesStore.equippedBadges = [makeEquipped(1, 10), makeEquipped(2, 20)]
    const serverResponse = [makeEquipped(1, 20), makeEquipped(2, 10)]
    mockApiModule.api.mockResolvedValue({ data: serverResponse })

    const { reorder } = useBadgeActions()
    await reorder(1, 2)

    expect(mockEmit).toHaveBeenCalledOnce()
    expect(mockEmit).toHaveBeenCalledWith('user:profileSync', { profile: { equipped_badges: serverResponse } })
  })

  it('does not emit on reorder failure (rollback path)', async () => {
    badgesStore.equippedBadges = [makeEquipped(1, 10), makeEquipped(2, 20)]
    mockApiModule.api.mockRejectedValue(new Error('fail'))

    const { reorder } = useBadgeActions()
    await reorder(1, 2)

    expect(mockEmit).not.toHaveBeenCalled()
  })
})
