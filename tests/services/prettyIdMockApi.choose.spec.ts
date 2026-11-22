// ========================================
// Pretty ID mock backend — Choose list and search tests
// ========================================
//
// See `tests/helpers/prettyIdMockHarness.ts` for the shared environment (pinned clock,
// localStorage stub, scripted RNG).

import { describe, it, expect, vi } from 'vitest'
import { PRETTY_ID_LIST_PAGE_SIZE, PRETTY_ID_SUGGESTION_LIMIT } from '~/constants/pretty-id'
import { validatePrettyId } from '~/utils/pretty-id-rules'
import {
  make,
  useMockBackendEnvironment,
} from '../helpers/prettyIdMockHarness'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

useMockBackendEnvironment()

describe('list', () => {
  it('returns the first page of available 6-digit IDs and the full count', async () => {
    const { api } = make()
    const { items, total } = await api.list({ length: 6, tier: null })

    expect(total).toBeGreaterThan(0)
    expect(items.length).toBe(Math.min(total, PRETTY_ID_LIST_PAGE_SIZE))
    expect(items.every(item => item.id.length === 6 && validatePrettyId(item.id, 6) === null)).toBe(true)
    expect(items.map(item => item.id)).toContain('111111')
  })

  it('leaves out IDs somebody already owns', async () => {
    const { api } = make()
    const six = (await api.list({ length: 6, tier: null })).items.map(item => item.id)
    for (const owned of ['888888', '520520', '123456', '666666', '168168']) {
      expect(six).not.toContain(owned)
    }
    const four = (await api.list({ length: 4, tier: null })).items.map(item => item.id)
    expect(four).not.toContain('8888')
    expect(four).toContain('1111')
  })

  it('filters by tier and counts only that tier', async () => {
    const { api } = make()
    const all = await api.list({ length: 6, tier: null })
    const legends = await api.list({ length: 6, tier: 'legend' })

    expect(legends.items.length).toBeGreaterThan(0)
    expect(legends.items.every(item => item.tier === 'legend')).toBe(true)
    expect(legends.total).toBeLessThan(all.total)
    expect(legends.items.map(item => item.id)).toContain('111111')
    expect(legends.items.map(item => item.id)).not.toContain('888888')

    const sequences = await api.list({ length: 6, tier: 'sequence' })
    expect(sequences.items.every(item => item.tier === 'sequence')).toBe(true)
  })

  it('drops an ID from the list once it is claimed', async () => {
    const { api } = make()
    await api.claim('111111')
    const { items } = await api.list({ length: 6, tier: null })
    expect(items.map(item => item.id)).not.toContain('111111')
  })
})

describe('search', () => {
  it('rejects malformed input with a message', async () => {
    const { api } = make()

    expect(await api.search('abc')).toMatchObject({ available: false, reason: 'invalid', message: 'Digits only', suggestions: [] })
    expect(await api.search('12345')).toMatchObject({
      available: false, reason: 'invalid', message: 'Pretty IDs are 6 digits (Lv 17) or 4 digits (Lv 34)',
    })
    expect(await api.search('012345')).toMatchObject({
      available: false, reason: 'invalid', message: 'That number can\'t be used (leading zero)',
    })
  })

  it('sends 1–99 to the auction', async () => {
    const { api } = make()
    expect(await api.search('7')).toEqual({
      id: '7', available: false, reason: 'auction_only', message: null, tier: null, suggestions: [],
    })
    expect((await api.search('99')).reason).toBe('auction_only')
  })

  it('reports a free ID with its tier', async () => {
    const { api } = make()
    expect(await api.search('111111')).toEqual({
      id: '111111', available: true, reason: null, message: null, tier: 'legend', suggestions: [],
    })
  })

  it('reports an owned ID as taken, with free same-pattern suggestions', async () => {
    const { api } = make()
    const result = await api.search('888888')

    expect(result).toMatchObject({ available: false, reason: 'taken', message: null })
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions.length).toBeLessThanOrEqual(PRETTY_ID_SUGGESTION_LIMIT)
    const free = (await api.list({ length: 6, tier: null })).items.map(item => item.id)
    for (const suggestion of result.suggestions) {
      expect(suggestion.id).not.toBe('888888')
      expect(validatePrettyId(suggestion.id, 6)).toBeNull()
      expect(await api.search(suggestion.id)).toMatchObject({ available: true })
    }
    expect(free.length).toBeGreaterThan(0)
  })

  it('reports a blocked number as reserved, with suggestions', async () => {
    const { api } = make()
    const result = await api.search('444444')
    expect(result).toMatchObject({ available: false, reason: 'reserved' })
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect((await api.search('1000')).reason).toBe('reserved')
    expect((await api.search('100500')).reason).toBe('reserved')
  })

  it('reports a just-released ID as reserved for 72 hours', async () => {
    const { api, controls } = make()
    await api.claim('111111')
    controls.skipHours(24)
    await api.change('222222', 'lv17')

    expect(await api.search('111111')).toMatchObject({ available: false, reason: 'reserved' })
    controls.skipHours(71)
    expect((await api.search('111111')).reason).toBe('reserved')
    controls.skipHours(1)
    expect(await api.search('111111')).toMatchObject({ available: true, reason: null })
  })
})

// ========================================
// Claim
// ========================================
