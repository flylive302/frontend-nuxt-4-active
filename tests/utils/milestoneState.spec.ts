import { describe, it, expect } from 'vitest'
import { deriveMilestoneState, rederiveMilestoneStates } from '~/utils/mission/milestoneState'
import type { MilestoneProgress } from '~/types/mission/recharge'

// =========================================================================
// deriveMilestoneState
// =========================================================================

describe('deriveMilestoneState', () => {
  it('is locked when volume is below threshold', () => {
    expect(deriveMilestoneState(999, 1_000)).toBe('locked')
  })

  it('is claimable when volume exactly equals threshold', () => {
    expect(deriveMilestoneState(1_000, 1_000)).toBe('claimable')
  })

  it('is claimable when volume exceeds threshold', () => {
    expect(deriveMilestoneState(5_000, 1_000)).toBe('claimable')
  })

  it('is locked at zero volume', () => {
    expect(deriveMilestoneState(0, 1_000)).toBe('locked')
  })

  it('is claimable for a zero-threshold milestone', () => {
    expect(deriveMilestoneState(0, 0)).toBe('claimable')
  })
})

// =========================================================================
// rederiveMilestoneStates
// =========================================================================

const milestone = (id: number, threshold: number): MilestoneProgress => ({
  id,
  threshold,
  sort_order: id,
  state: 'locked',
  rewards: [],
})

describe('rederiveMilestoneStates', () => {
  it('returns all locked when volume is 0', () => {
    const result = rederiveMilestoneStates(
      [milestone(1, 1_000), milestone(2, 5_000)],
      0,
    )
    expect(result.map(m => m.state)).toEqual(['locked', 'locked'])
  })

  it('makes lower tiers claimable while leaving higher tiers locked', () => {
    const result = rederiveMilestoneStates(
      [milestone(1, 1_000), milestone(2, 5_000), milestone(3, 20_000)],
      6_000,
    )
    expect(result.map(m => m.state)).toEqual(['claimable', 'claimable', 'locked'])
  })

  it('makes all tiers claimable when volume covers all thresholds', () => {
    const result = rederiveMilestoneStates(
      [milestone(1, 1_000), milestone(2, 5_000)],
      20_000,
    )
    expect(result.map(m => m.state)).toEqual(['claimable', 'claimable'])
  })

  it('does not mutate the input milestones', () => {
    const milestones = [milestone(1, 1_000)]
    rederiveMilestoneStates(milestones, 5_000)
    expect(milestones[0].state).toBe('locked')
  })

  it('returns an empty array for empty input', () => {
    expect(rederiveMilestoneStates([], 9_999)).toEqual([])
  })
})
