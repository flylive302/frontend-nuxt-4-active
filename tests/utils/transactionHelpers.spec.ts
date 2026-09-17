import { describe, it, expect } from 'vitest'
import { getTransactionLabel } from '../../app/utils/economy/transactionHelpers'
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
