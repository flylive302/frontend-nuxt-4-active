import { describe, it, expect } from 'vitest'
import { createInFlightLedger } from '../../app/utils/in-flight-ledger'

describe('createInFlightLedger', () => {
  it('starts empty', () => {
    const ledger = createInFlightLedger()
    expect(ledger.total).toBe(0)
  })

  it('totals the cost of every reserved id', () => {
    const ledger = createInFlightLedger()
    const costs = { a: 50, b: 125, c: 7 }
    ledger.reserve('a', costs.a)
    ledger.reserve('b', costs.b)
    ledger.reserve('c', costs.c)
    expect(ledger.total).toBe(costs.a + costs.b + costs.c)
  })

  it('release removes only that id', () => {
    const ledger = createInFlightLedger()
    ledger.reserve('a', 50)
    ledger.reserve('b', 125)
    ledger.release('a')
    expect(ledger.total).toBe(125)
  })

  it('release of an unknown or already-released id is a no-op (idempotent)', () => {
    const ledger = createInFlightLedger()
    ledger.reserve('a', 50)
    ledger.release('missing')
    ledger.release('a')
    ledger.release('a')
    expect(ledger.total).toBe(0)
  })

  it('re-reserving an id replaces its cost instead of double counting', () => {
    const ledger = createInFlightLedger()
    ledger.reserve('a', 50)
    ledger.reserve('a', 80)
    expect(ledger.total).toBe(80)
  })
})
