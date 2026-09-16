import { describe, it, expect } from 'vitest'
import {
  isOwnerIncomeMemberTappable,
  ownerIncomeMilestoneKey,
  ownerIncomeSheetGiftCoins,
} from '../../app/utils/ownerIncomeCard'

describe('isOwnerIncomeMemberTappable', () => {
  it('run mode: tappable when the member has a run', () => {
    expect(isOwnerIncomeMemberTappable('run', 5)).toBe(true)
  })

  it('run mode: not tappable when run_id is null', () => {
    expect(isOwnerIncomeMemberTappable('run', null)).toBe(false)
  })

  it('range mode: always tappable, even with run_id null', () => {
    expect(isOwnerIncomeMemberTappable('range', null)).toBe(true)
  })

  it('range mode: still tappable when run_id happens to be a number', () => {
    expect(isOwnerIncomeMemberTappable('range', 5)).toBe(true)
  })
})

describe('ownerIncomeSheetGiftCoins', () => {
  it('run mode reads run.accumulated_xp', () => {
    expect(ownerIncomeSheetGiftCoins('run', 1200, undefined)).toBe(1200)
  })

  it('run mode falls back to 0 when accumulated_xp is null', () => {
    expect(ownerIncomeSheetGiftCoins('run', null, 999)).toBe(0)
  })

  it('range mode reads totals.gift_coins', () => {
    expect(ownerIncomeSheetGiftCoins('range', null, 340)).toBe(340)
  })

  it('range mode falls back to 0 when gift_coins is absent', () => {
    expect(ownerIncomeSheetGiftCoins('range', null, undefined)).toBe(0)
  })

  it('range mode falls back to 0 when gift_coins is null', () => {
    expect(ownerIncomeSheetGiftCoins('range', null, null)).toBe(0)
  })
})

describe('ownerIncomeMilestoneKey', () => {
  it('keys on run_id + tier when run_id is present (range mode)', () => {
    expect(ownerIncomeMilestoneKey({ tier: 3, run_id: 7 } as never)).toBe('7:3')
  })

  it('falls back to "run" when run_id is absent (run mode)', () => {
    expect(ownerIncomeMilestoneKey({ tier: 3 } as never)).toBe('run:3')
  })

  it('distinguishes the same tier across two different runs', () => {
    const a = ownerIncomeMilestoneKey({ tier: 2, run_id: 1 } as never)
    const b = ownerIncomeMilestoneKey({ tier: 2, run_id: 2 } as never)
    expect(a).not.toBe(b)
  })
})
