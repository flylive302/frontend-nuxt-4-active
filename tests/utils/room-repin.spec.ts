import { describe, expect, it } from 'vitest'
import { planRoomRepin } from '../../app/utils/room-repin'
import {
  REPIN_BASE_BUDGET_MS,
  REPIN_CONSUME_BATCH_BUDGET_MS,
  ROOM_RECONSUME_CONCURRENCY,
} from '../../app/constants/room'

// ============================================================
// aws-production 21 — a client follows its Room when it moves.
//
// The re-pin decision is a pure planner: no sockets, no WebRTC,
// no mocks. Construct a state, call the planner, assert the plan
// — same shape as mediaTransport.spec.ts.
// ============================================================

const OLD_URL = 'https://msab-old.audio.flyliveapp.com'
const NEW_URL = 'https://msab-new.audio.flyliveapp.com'

function input(overrides: Partial<Parameters<typeof planRoomRepin>[0]> = {}) {
  return {
    trigger: 'drain' as const,
    currentUrl: OLD_URL,
    nextUrl: NEW_URL,
    speakerCount: 0,
    ...overrides,
  }
}

describe('planRoomRepin — permitted triggers (exhaustive allowlist)', () => {
  it('permits a re-pin on drain', () => {
    const plan = planRoomRepin(input({ trigger: 'drain' }))
    expect(plan.repin).toBe(true)
  })

  it('permits a re-pin on health failure', () => {
    const plan = planRoomRepin(input({ trigger: 'health-failure' }))
    expect(plan.repin).toBe(true)
  })

  it.each(['load-balance', 'pack', 'speculative'] as const)(
    'refuses a re-pin for %s',
    (trigger) => {
      const plan = planRoomRepin(input({ trigger }))
      expect(plan).toEqual({ repin: false, reason: 'trigger-not-permitted' })
    },
  )
})

describe('planRoomRepin — address comparison', () => {
  it('does not re-pin when the address is unchanged', () => {
    const plan = planRoomRepin(input({ currentUrl: OLD_URL, nextUrl: OLD_URL }))
    expect(plan).toEqual({ repin: false, reason: 'address-unchanged' })
  })

  it('does not re-pin without a target address (dev / missing hosting_url)', () => {
    const plan = planRoomRepin(input({ nextUrl: null }))
    expect(plan).toEqual({ repin: false, reason: 'no-target' })
  })

  it('re-pins from an unknown current address (fresh socket after teardown)', () => {
    const plan = planRoomRepin(input({ currentUrl: null }))
    expect(plan.repin).toBe(true)
    if (plan.repin) expect(plan.targetUrl).toBe(NEW_URL)
  })
})

describe('planRoomRepin — budget is stated per speaker count (post-04 concurrent shape)', () => {
  it('N=0: base budget only (no producers to consume)', () => {
    const plan = planRoomRepin(input({ speakerCount: 0 }))
    expect(plan.repin).toBe(true)
    if (plan.repin) expect(plan.budgetMs).toBe(REPIN_BASE_BUDGET_MS)
  })

  it('N=1: base plus one concurrent consume batch', () => {
    const plan = planRoomRepin(input({ speakerCount: 1 }))
    expect(plan.repin).toBe(true)
    if (plan.repin) {
      expect(plan.budgetMs).toBe(REPIN_BASE_BUDGET_MS + REPIN_CONSUME_BATCH_BUDGET_MS)
    }
  })

  it('many speakers: batches scale with ceil(N / concurrency), not with N', () => {
    const n = 10
    const batches = Math.ceil(n / ROOM_RECONSUME_CONCURRENCY)
    const plan = planRoomRepin(input({ speakerCount: n }))
    expect(plan.repin).toBe(true)
    if (plan.repin) {
      expect(plan.budgetMs).toBe(
        REPIN_BASE_BUDGET_MS + batches * REPIN_CONSUME_BATCH_BUDGET_MS,
      )
    }
  })

  it('a full 30-seat room stays a bounded budget, not 30 serial timeouts', () => {
    const plan = planRoomRepin(input({ speakerCount: 30 }))
    expect(plan.repin).toBe(true)
    if (plan.repin) {
      expect(plan.budgetMs).toBeLessThan(30 * 10_000)
    }
  })
})
