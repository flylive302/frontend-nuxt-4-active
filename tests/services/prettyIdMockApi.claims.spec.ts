// ========================================
// Pretty ID mock backend — claim and change tests
// ========================================
//
// See `tests/helpers/prettyIdMockHarness.ts` for the shared environment (pinned clock,
// localStorage stub, scripted RNG).

import { describe, it, expect, vi } from 'vitest'
import { PRETTY_ID_SUGGESTION_LIMIT } from '~/constants/pretty-id'
import {
  DAY,
  HOUR,
  NOON,
  make,
  refusal,
  useMockBackendEnvironment,
} from '../helpers/prettyIdMockHarness'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

useMockBackendEnvironment()

describe('claim', () => {
  it('fills the slot, starts the cooldown and gives one change token', async () => {
    const { api } = make()
    const result = await api.claim('111111')

    expect(result).toMatchObject({ id: '111111', slot: 'lv17', changed: false })
    const slot = result.me.slots.lv17
    expect(slot).toMatchObject({ id: '111111', change_tokens: 1, claimed_at: new Date(NOON).toISOString() })
    expect(slot.next_change_at).toBe(new Date(NOON + DAY).toISOString())
    expect((await api.me()).slots.lv17.id).toBe('111111')
    expect((await api.search('111111')).reason).toBe('taken')
  })

  it('refuses a second claim for the same slot', async () => {
    const { api } = make()
    await api.claim('111111')
    const error = await refusal(api.claim('222222'))

    expect(error.code).toBe('already_claimed')
    expect(error.message).toBe('Already claimed for this level. Use a change token in My ID.')
    expect((await api.me()).slots.lv17.id).toBe('111111')
  })

  it('gates 4-digit IDs behind Lv 34', async () => {
    const { api, controls } = make()
    const error = await refusal(api.claim('1111'))
    expect(error.code).toBe('level_required')
    expect(error.message).toBe('Reach Lv 34 to unlock 4-digit IDs')

    controls.setLevel(34)
    const result = await api.claim('1111')
    expect(result.slot).toBe('lv34')
    expect(result.me.slots.lv34).toMatchObject({ id: '1111', unlocked: true })
  })

  it('gates the 6-digit slot behind Lv 17', async () => {
    const { api, controls } = make()
    controls.setLevel(5)
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

  it('lets the race lever steal the next claim exactly once', async () => {
    const { api, controls } = make()
    controls.toggleRace()
    expect(controls.state().race_armed).toBe(true)

    const error = await refusal(api.claim('222222'))
    expect(error.code).toBe('taken')
    expect(error.suggestions.length).toBeGreaterThan(0)
    expect(error.suggestions.map(s => s.id)).not.toContain('222222')
    expect(controls.state().race_armed).toBe(false)
    expect((await api.search('222222')).reason).toBe('taken')
    expect((await api.me()).slots.lv17.id).toBeNull()

    expect((await api.claim('333333')).me.slots.lv17.id).toBe('333333')
  })

  it('checks the level before the race lever fires', async () => {
    const { api, controls } = make()
    controls.setLevel(5)
    controls.toggleRace()
    expect((await refusal(api.claim('111111'))).code).toBe('level_required')
    expect(controls.state().race_armed).toBe(true)
  })
})

// ========================================
// Change
// ========================================

describe('change', () => {
  it('refuses when nothing is claimed yet', async () => {
    const { api } = make()
    expect((await refusal(api.change('111111', 'lv17'))).code).toBe('nothing_to_change')
  })

  it('refuses inside the 24 h cooldown, then succeeds once it has passed', async () => {
    const { api, controls } = make()
    await api.claim('111111')

    const tooSoon = await refusal(api.change('222222', 'lv17'))
    expect(tooSoon.code).toBe('cooldown')
    expect(tooSoon.message).toBe('Too soon: next change in 1D 00:00:00')

    controls.skipHours(23)
    expect((await refusal(api.change('222222', 'lv17'))).message).toBe('Too soon: next change in 01:00:00')

    controls.skipHours(1)
    const result = await api.change('222222', 'lv17')
    expect(result).toMatchObject({ id: '222222', slot: 'lv17', changed: true })
    expect(result.me.slots.lv17).toMatchObject({ id: '222222', change_tokens: 0 })
    expect(result.me.slots.lv17.next_change_at).toBe(new Date(NOON + 48 * HOUR).toISOString())
  })

  it('checks tokens before the cooldown', async () => {
    const { api, controls } = make()
    await api.claim('111111')
    controls.skipHours(24)
    await api.change('222222', 'lv17')

    expect((await refusal(api.change('333333', 'lv17'))).code).toBe('no_tokens')
    controls.skipHours(24)
    expect((await refusal(api.change('333333', 'lv17'))).message).toBe('No change tokens left')
  })

  it('accepts another change after a token is added', async () => {
    const { api, controls } = make()
    expect(controls.addChangeToken()).toBe(false)

    await api.claim('111111')
    controls.skipHours(24)
    await api.change('222222', 'lv17')
    expect(controls.addChangeToken()).toBe(true)
    expect((await api.me()).slots.lv17.change_tokens).toBe(1)

    expect((await refusal(api.change('333333', 'lv17'))).code).toBe('cooldown')
    controls.skipHours(24)
    expect((await api.change('333333', 'lv17')).me.slots.lv17.id).toBe('333333')
  })

  it('releases the old ID into a 72 h cooldown', async () => {
    const { api, controls } = make()
    await api.claim('111111')
    controls.skipHours(24)
    await api.change('222222', 'lv17')

    expect((await api.list({ length: 6, tier: null })).items.map(i => i.id)).not.toContain('111111')
    expect((await refusal(api.claim('111111'))).code).toBe('taken')
    controls.skipHours(72)
    expect((await api.list({ length: 6, tier: null })).items.map(i => i.id)).toContain('111111')
  })

  it('refuses an ID that is not free, and an ID of the wrong length for the slot', async () => {
    const { api, controls } = make()
    await api.claim('111111')
    controls.skipHours(24)

    expect((await refusal(api.change('888888', 'lv17'))).code).toBe('taken')
    expect((await refusal(api.change('111111', 'lv17'))).code).toBe('taken')
    const wrongSlot = await refusal(api.change('1111', 'lv17'))
    expect(wrongSlot.code).toBe('invalid')
    expect(wrongSlot.message).toBe('That slot takes 6-digit IDs')
  })

  it('lets the race lever steal a change too, leaving the old ID in place', async () => {
    const { api, controls } = make()
    await api.claim('111111')
    controls.skipHours(24)
    controls.toggleRace()

    expect((await refusal(api.change('222222', 'lv17'))).code).toBe('taken')
    expect((await api.me()).slots.lv17).toMatchObject({ id: '111111', change_tokens: 1 })
  })
})

// ========================================
// Auctions: entering and bidding
// ========================================
