// ========================================
// useUserProfile Composable Tests
// ========================================
// Covers docs/issues/profile-signature-page-audit (steps 1 + 2):
// - hasRoom / hasAgency are false while there is no profile (was `!== null`,
//   which is true for `undefined` and rendered dead footer buttons).
// - Level badges are derived, so a profile fetched before bootstrap is ready
//   self-corrects once `isReady` flips — no refetch.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { watch, readonly, toValue, nextTick, reactive } from 'vue'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockBootstrapStore,
} from '../helpers/nuxtMocks'
import { DEFAULT_WEALTH_BADGE, DEFAULT_CHARM_BADGE } from '~/composables/shared/useLevelLookup'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('watch', watch)
vi.stubGlobal('toValue', toValue)
vi.stubGlobal('readonly', readonly)

let apiMock = vi.fn()
let bootstrapStore: ReturnType<typeof createMockBootstrapStore>

function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success',
    data: {
      id: 7,
      name: 'Ann',
      signature: 'ann',
      wealth_xp: '150',   // Silver in the mock config
      charm_xp: '250',    // Super Star in the mock config
      agency: null,
      room_id: null,
      gifts_received: [],
      gifts_next_cursor: null,
      gifts_has_more: false,
      ...overrides,
    },
  }
}

async function flushMicrotasks(rounds = 4) {
  for (let i = 0; i < rounds; i++) await Promise.resolve()
}

beforeEach(() => {
  vi.resetModules()
  // reactive() so a later `isReady` flip invalidates computeds reading the store.
  bootstrapStore = reactive(createMockBootstrapStore()) as ReturnType<typeof createMockBootstrapStore>
  setupNuxtMocks({ bootstrapStore })
  apiMock = vi.fn().mockResolvedValue(profilePayload())
  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  })
})

afterEach(() => {
  cleanupNuxtMocks()
  Reflect.deleteProperty(globalThis, 'useLevelLookup')
})

async function load() {
  const lookup = await import('~/composables/shared/useLevelLookup')
  ;(globalThis as Record<string, unknown>).useLevelLookup = lookup.useLevelLookup
  const { useUserProfile } = await import('~/composables/user/useUserProfile')
  return useUserProfile
}

describe('useUserProfile — hasRoom / hasAgency null semantics', () => {
  it('are false before the profile loads', async () => {
    apiMock = vi.fn(() => new Promise(() => {})) // never resolves
    const useUserProfile = await load()
    const { hasProfile, hasRoom, hasAgency } = useUserProfile(() => 'ann')

    expect(hasProfile.value).toBe(false)
    expect(hasRoom.value).toBe(false)
    expect(hasAgency.value).toBe(false)
  })

  it('are false when the loaded profile has room_id: null and agency: null', async () => {
    const useUserProfile = await load()
    const { hasProfile, hasRoom, hasAgency } = useUserProfile(() => 'ann')
    await flushMicrotasks()

    expect(hasProfile.value).toBe(true)
    expect(hasRoom.value).toBe(false)
    expect(hasAgency.value).toBe(false)
  })

  it('are true when room_id is a number and agency is an object', async () => {
    apiMock.mockResolvedValue(profilePayload({
      room_id: 42,
      agency: { id: 1, name: 'A', logo: '', country: 'PK', total_member_count: 1 },
    }))
    const useUserProfile = await load()
    const { hasRoom, hasAgency } = useUserProfile(() => 'ann')
    await flushMicrotasks()

    expect(hasRoom.value).toBe(true)
    expect(hasAgency.value).toBe(true)
  })
})

describe('useUserProfile — level badges follow bootstrap readiness', () => {
  it('shows real badges once isReady flips after the profile fetched (no refetch)', async () => {
    bootstrapStore.isReady = false
    const useUserProfile = await load()
    const { wealthBadgeSrc, charmBadgeSrc, wealthLevel, charmLevel } = useUserProfile(() => 'ann')
    await flushMicrotasks()

    // Cold bootstrap: config not ready → defaults.
    expect(wealthBadgeSrc.value).toBe(DEFAULT_WEALTH_BADGE)
    expect(charmBadgeSrc.value).toBe(DEFAULT_CHARM_BADGE)
    expect(wealthLevel.value).toBe(0)

    bootstrapStore.isReady = true
    await nextTick()

    expect(wealthBadgeSrc.value).toBe('https://example.com/silver.webp')
    expect(charmBadgeSrc.value).toBe('https://example.com/superstar.webp')
    expect(wealthLevel.value).toBe(2)
    expect(charmLevel.value).toBe(2)
    expect(apiMock).toHaveBeenCalledTimes(1)
  })

  it('returns defaults with no profile', async () => {
    apiMock = vi.fn(() => new Promise(() => {}))
    const useUserProfile = await load()
    const { wealthBadgeSrc, wealthLevel } = useUserProfile(() => 'ann')

    expect(wealthBadgeSrc.value).toBe(DEFAULT_WEALTH_BADGE)
    expect(wealthLevel.value).toBe(0)
  })
})
