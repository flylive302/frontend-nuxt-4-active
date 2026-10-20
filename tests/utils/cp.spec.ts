import { describe, expect, it } from 'vitest'
import { cpFrameId, cpProfilePath, excludeExistingPairs, padTwo, splitCountdownHours, winnerToPairCard } from '../../app/utils/cp'

const config = { frame_male: 11, frame_female: 22 }

describe('cpFrameId', () => {
  it('female → frame_female', () => {
    expect(cpFrameId({ gender: '2' }, config)).toBe(22)
    expect(cpFrameId({ gender: 'female' }, config)).toBe(22)
  })

  it('male, null and other genders → frame_male', () => {
    expect(cpFrameId({ gender: '1' }, config)).toBe(11)
    expect(cpFrameId({ gender: null }, config)).toBe(11)
    expect(cpFrameId({ gender: '3' }, config)).toBe(11)
    expect(cpFrameId({ gender: '4' }, config)).toBe(11)
  })

  it('returns null when the setting is unset', () => {
    expect(cpFrameId({ gender: '2' }, { frame_male: 1, frame_female: null })).toBeNull()
  })
})

describe('cpProfilePath', () => {
  it('builds /cp-event/{signature}-cp', () => {
    expect(cpProfilePath('abc123')).toBe('/cp-event/abc123-cp')
  })
})

describe('countdown helpers', () => {
  it('splits total hours into days + hours', () => {
    expect(splitCountdownHours(50)).toEqual({ days: 2, hours: 2 })
    expect(splitCountdownHours(5)).toEqual({ days: 0, hours: 5 })
  })

  it('pads to two digits', () => {
    expect(padTwo(3)).toBe('03')
    expect(padTwo(42)).toBe('42')
  })
})

describe('excludeExistingPairs', () => {
  it('drops known and repeated pair_ids, keeps order', () => {
    const existing = [{ pair_id: 1 }, { pair_id: 2 }]
    const incoming = [{ pair_id: 2 }, { pair_id: 3 }, { pair_id: 3 }, { pair_id: 4 }]
    expect(excludeExistingPairs(existing, incoming)).toEqual([{ pair_id: 3 }, { pair_id: 4 }])
  })
})

describe('winnerToPairCard', () => {
  const winnerUser = { id: 1, name: 'a', signature: 's', avatar: null, vip_level: 0, gender: null, frame_id: null }

  it('keeps weekly_score as weekly_score and does not overwrite lifetime_intimacy', () => {
    const card = winnerToPairCard({ week_key: '2026-W42', rank: 1, pair_id: 9, binder: winnerUser, partner: winnerUser, weekly_score: 50 })
    expect(card.weekly_score).toBe(50)
    expect(card.lifetime_intimacy).toBe(0)
    expect(card.weekly_rank).toBe(1)
  })

  it('turns a deleted user into a placeholder card', () => {
    const card = winnerToPairCard({ week_key: '2026-W42', rank: 2, pair_id: 9, binder: null, partner: winnerUser, weekly_score: 5 })
    expect(card.binder.name).toBe('Deleted user')
    expect(card.partner).toBe(winnerUser)
  })
})
