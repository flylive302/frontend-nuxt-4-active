// ========================================
// Pretty ID mock backend — seed and persistence tests
// ========================================
//
// See `tests/helpers/prettyIdMockHarness.ts` for the shared environment (pinned clock,
// localStorage stub).

import { describe, it, expect, vi } from 'vitest'
import { createPrettyIdMockApi } from '~/services/prettyIdMockApi'
import { PRETTY_ID_MOCK_STORAGE_KEY } from '~/services/prettyIdMock/state'
import {
  NOON,
  PROFILE,
  currentStorage,
  make,
  stored,
  useMockBackendEnvironment,
} from '../helpers/prettyIdMockHarness'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

useMockBackendEnvironment()

describe('seed', () => {
  it('starts the user at Lv 17 with nothing claimed', async () => {
    const { api } = make()
    const me = await api.me()

    expect(me.level).toBe(17)
    expect(me.server_now).toBe(new Date(NOON).toISOString())
    expect(me.slots.lv17).toEqual({ key: 'lv17', required_level: 17, length: 6, unlocked: true, id: null })
    expect(me.slots.lv34).toEqual({ key: 'lv34', required_level: 34, length: 4, unlocked: false, id: null })
  })

  it('carries no coins, auction or change-token data on me', async () => {
    const { api } = make()
    const me = await api.me()

    expect(Object.keys(me).sort()).toEqual(['level', 'server_now', 'slots'])
  })
})

// ========================================
// Persistence
// ========================================

describe('persistence', () => {
  it('writes the state to localStorage under one versioned key', async () => {
    const { api } = make()
    expect(currentStorage().getItem(PRETTY_ID_MOCK_STORAGE_KEY)).toBeNull()
    await api.me()

    expect(PRETTY_ID_MOCK_STORAGE_KEY).toBe('flylive.prettyId.mock.v2')
    expect(stored()).toMatchObject({ version: 2, owner_id: PROFILE.id })
  })

  it('ignores a stored blob from an older schema version, reseeding cleanly', async () => {
    currentStorage().setItem(PRETTY_ID_MOCK_STORAGE_KEY, JSON.stringify({ version: 1, owner_id: PROFILE.id, level: 40, coins: 1 }))

    const me = await make().api.me()

    expect(me.level).toBe(17)
  })

  it('survives a second factory call', async () => {
    await make().api.claim('111111')
    const second = make()
    expect((await second.api.me()).slots.lv17.id).toBe('111111')
    expect((await second.api.search('111111')).reason).toBe('taken')
  })

  it('shares state between two live instances instead of overwriting', async () => {
    const a = make()
    const b = make()
    await a.api.claim('111111')
    await b.api.list({ length: 6, tier: null })

    expect((await a.api.me()).slots.lv17.id).toBe('111111')
  })

  it('reseeds when the stored blob is missing', async () => {
    const { api } = make()
    await api.claim('111111')
    currentStorage().removeItem(PRETTY_ID_MOCK_STORAGE_KEY)

    expect((await api.me()).slots.lv17.id).toBeNull()
  })

  it('reseeds when the stored blob is garbage or from an older schema', async () => {
    const { api } = make()
    await api.claim('111111')

    currentStorage().setItem(PRETTY_ID_MOCK_STORAGE_KEY, '{not json')
    expect((await api.me()).slots.lv17.id).toBeNull()

    await api.claim('222222')
    currentStorage().setItem(PRETTY_ID_MOCK_STORAGE_KEY, JSON.stringify({ ...stored(), version: 1 }))
    expect((await api.me()).slots.lv17.id).toBeNull()

    await api.claim('333333')
    currentStorage().setItem(PRETTY_ID_MOCK_STORAGE_KEY, JSON.stringify({ version: 2 }))
    expect((await api.me()).slots.lv17.id).toBeNull()
  })

  it('reseeds for a different signed-in user', async () => {
    await make().api.claim('111111')
    const other = createPrettyIdMockApi({ id: 999 })
    const me = await other.me()

    expect(me.slots.lv17.id).toBeNull()
    expect(stored().owner_id).toBe(999)
  })

  it('persists the state of a refused claim attempt', async () => {
    const { api } = make()
    await api.claim('111111')
    await expect(api.claim('222222')).rejects.toMatchObject({ code: 'already_claimed' })

    expect((await make().api.me()).slots.lv17.id).toBe('111111')
  })

  it('keeps working in memory when localStorage throws', async () => {
    const blocked = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => { throw new Error('SecurityError') },
    }
    vi.stubGlobal('localStorage', blocked)
    vi.resetModules()
    const fresh = await import('~/services/prettyIdMockApi')
    const api = fresh.createPrettyIdMockApi(PROFILE)

    expect((await api.claim('111111')).me.slots.lv17.id).toBe('111111')
    expect((await api.me()).slots.lv17.id).toBe('111111')
  })
})
