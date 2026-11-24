// ========================================
// Pretty ID mock backend — claim tests
// ========================================
//
// See `tests/helpers/prettyIdMockHarness.ts` for the shared environment (pinned clock,
// localStorage stub).

import { describe, it, expect, vi } from 'vitest'
import { PRETTY_ID_SUGGESTION_LIMIT } from '~/constants/pretty-id'
import {
  make,
  refusal,
  setLevel,
  useMockBackendEnvironment,
} from '../helpers/prettyIdMockHarness'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

useMockBackendEnvironment()

describe('claim', () => {
  it('fills the slot', async () => {
    const { api } = make()
    const result = await api.claim('111111')

    expect(result).toMatchObject({ id: '111111', slot: 'lv17' })
    expect(result.me.slots.lv17).toMatchObject({ id: '111111' })
    expect((await api.me()).slots.lv17.id).toBe('111111')
    expect((await api.search('111111')).reason).toBe('taken')
  })

  it('refuses a second claim for the same slot', async () => {
    const { api } = make()
    await api.claim('111111')
    const error = await refusal(api.claim('222222'))

    expect(error.code).toBe('already_claimed')
    expect(error.message).toBe('You already claimed an ID for this level.')
    expect((await api.me()).slots.lv17.id).toBe('111111')
  })

  it('gates 4-digit IDs behind Lv 34', async () => {
    const { api } = make()
    const error = await refusal(api.claim('1111'))
    expect(error.code).toBe('level_required')
    expect(error.message).toBe('Reach Lv 34 to unlock 4-digit IDs')

    await setLevel(api, 34)
    const result = await api.claim('1111')
    expect(result.slot).toBe('lv34')
    expect(result.me.slots.lv34).toMatchObject({ id: '1111', unlocked: true })
  })

  it('gates the 6-digit slot behind Lv 17', async () => {
    const { api } = make()
    await setLevel(api, 5)
    const error = await refusal(api.claim('111111'))
    expect(error.code).toBe('level_required')
    expect(error.message).toBe('Reach Lv 17 to unlock 6-digit IDs')
  })

  it('refuses an owned ID as taken, with suggestions', async () => {
    const { api } = make()
    const error = await refusal(api.claim('888888'))

    expect(error.code).toBe('taken')
    expect(error.message).toBe('That ID is no longer available')
    expect(error.suggestions.length).toBeGreaterThan(0)
    expect(error.suggestions.length).toBeLessThanOrEqual(PRETTY_ID_SUGGESTION_LIMIT)
    expect(error.suggestions.map(s => s.id)).not.toContain('888888')
  })

  it('refuses a reserved number as taken', async () => {
    const { api } = make()
    expect((await refusal(api.claim('444444'))).code).toBe('taken')
  })

  it('refuses malformed IDs as invalid', async () => {
    const { api } = make()
    expect((await refusal(api.claim('abc'))).code).toBe('invalid')
    expect((await refusal(api.claim('12345'))).code).toBe('invalid')
    expect((await refusal(api.claim('012345'))).code).toBe('invalid')
    const auctionOnly = await refusal(api.claim('7'))
    expect(auctionOnly.code).toBe('invalid')
    expect(auctionOnly.message).toBe('1–99 are rare auction-only IDs')
  })

  it('checks the level before availability', async () => {
    const { api } = make()
    await setLevel(api, 5)
    expect((await refusal(api.claim('888888'))).code).toBe('level_required')
  })
})
