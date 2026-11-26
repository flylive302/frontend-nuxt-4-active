import { describe, it, expect } from 'vitest'
import {
  getTransactionHeadline,
  getTransactionLabel,
  isPositiveTransaction,
} from '../../app/utils/economy/transactionHelpers'
import type { Transaction } from '../../app/types/economy/wallet'

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn_1',
    type: 'gift',
    timestamp: '2026-09-17T10:00:00Z',
    title: 'Gift',
    description: 'Sent gift to @user',
    status: 'completed',
    my_role: 'initiator',
    amount: { value: -100, currency: 'coins', formatted: '-100.00' },
    my_balance: null,
    my_xp: null,
    other_party: null,
    metadata: {},
    ...overrides,
  }
}

describe('getTransactionLabel', () => {
  it('labels an Apple store purchase from metadata.store', () => {
    const txn = makeTransaction({ type: 'store_purchase', metadata: { store: 'apple' } })
    expect(getTransactionLabel(txn)).toBe('Coin pack (App Store)')
  })

  it('labels a Google store purchase from metadata.store', () => {
    const txn = makeTransaction({ type: 'store_purchase', metadata: { store: 'google' } })
    expect(getTransactionLabel(txn)).toBe('Coin pack (Google Play)')
  })

  it('labels an Apple refund from metadata.store', () => {
    const txn = makeTransaction({ type: 'store_refund', metadata: { store: 'apple' } })
    expect(getTransactionLabel(txn)).toBe('Refunded by App Store')
  })

  it('labels a Google refund from metadata.store', () => {
    const txn = makeTransaction({ type: 'store_refund', metadata: { store: 'google' } })
    expect(getTransactionLabel(txn)).toBe('Refunded by Google Play')
  })

  it('falls back to metadata.channel when metadata.store is missing', () => {
    const txn = makeTransaction({ type: 'store_purchase', metadata: { channel: 'iap_google' } })
    expect(getTransactionLabel(txn)).toBe('Coin pack (Google Play)')
  })

  it('falls back to the generic label when neither store nor channel is present', () => {
    const txn = makeTransaction({ type: 'store_purchase', metadata: {} })
    expect(getTransactionLabel(txn)).toBe('Coin Pack')
  })

  it('falls back to the generic label for an unrecognized store value', () => {
    const txn = makeTransaction({ type: 'store_refund', metadata: { store: 'amazon' as never } })
    expect(getTransactionLabel(txn)).toBe('Store Refund')
  })

  it('uses the flat TRANSACTION_TYPE_LABELS map for non-IAP types', () => {
    const txn = makeTransaction({ type: 'gift', metadata: {} })
    expect(getTransactionLabel(txn)).toBe('Gift')
  })

  it('the store-aware resolver wins over a non-empty description for store_purchase', () => {
    const txn = makeTransaction({
      type: 'store_purchase',
      description: 'Bought coin pack',
      metadata: { store: 'apple' },
    })
    // getTransactionLabel itself never reads `description` — pinning that
    // here documents the precedence transaction-item.vue relies on.
    expect(getTransactionLabel(txn)).toBe('Coin pack (App Store)')
    expect(getTransactionLabel(txn)).not.toBe(txn.description)
  })
})

describe('Rare ID auction transactions', () => {
  const cases = [
    { type: 'rare_id_entry_fee', value: -500, label: 'Rare ID 8888 auction entry fee', generic: 'Rare ID Auction Entry', positive: false },
    { type: 'rare_id_bid_hold', value: -2000, label: 'Rare ID 8888 bid', generic: 'Rare ID Bid Held', positive: false },
    { type: 'rare_id_bid_refund', value: 2000, label: 'Rare ID 8888 bid refund', generic: 'Rare ID Bid Refund', positive: true },
    { type: 'rare_id_entry_refund', value: 500, label: 'Rare ID 8888 entry fee refund', generic: 'Rare ID Entry Refund', positive: true },
  ] as const

  for (const c of cases) {
    describe(c.type, () => {
      const build = (overrides: Partial<Transaction> = {}) => makeTransaction({
        type: c.type,
        description: '',
        amount: { value: c.value, currency: 'coins', formatted: `${c.value}` },
        metadata: { rare_id: '8888' },
        ...overrides,
      })

      it('label names the Rare ID from metadata', () => {
        expect(getTransactionLabel(build())).toBe(c.label)
      })

      it('label falls back to the generic name without metadata.rare_id', () => {
        expect(getTransactionLabel(build({ metadata: {} }))).toBe(c.generic)
      })

      it('keeps leading zeros in the Rare ID', () => {
        expect(getTransactionLabel(build({ metadata: { rare_id: '0777' } }))).toContain('Rare ID 0777')
      })

      it('headline prefers the backend description', () => {
        expect(getTransactionHeadline(build({ description: 'Stored sentence for Rare ID 8888' })))
          .toBe('Stored sentence for Rare ID 8888')
      })

      it('headline names the Rare ID when description is empty, ignoring the title', () => {
        expect(getTransactionHeadline(build({ title: 'Rare ID Bid Held' }))).toBe(c.label)
      })

      it(`renders as a ${c.positive ? 'credit' : 'debit'}`, () => {
        expect(isPositiveTransaction(build())).toBe(c.positive)
      })
    })
  }

  it('headline keeps description > title > type label for non-auction types', () => {
    expect(getTransactionHeadline(makeTransaction({ description: '', title: 'Gift Title' }))).toBe('Gift Title')
    expect(getTransactionHeadline(makeTransaction({ description: '', title: '' }))).toBe('Gift')
  })

  it('headline still uses the store label for IAP rows', () => {
    expect(getTransactionHeadline(makeTransaction({ type: 'store_purchase', description: 'Bought coin pack', metadata: { store: 'apple' } })))
      .toBe('Coin pack (App Store)')
  })
})
