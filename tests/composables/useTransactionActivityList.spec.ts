// ========================================
// useTransactionActivityList Composable Tests
// ========================================
// Covers flattening day-grouped transactions into a single heterogeneous
// list (header + transaction items) for the virtualized activity page,
// and the collapse/expand behavior that hides/restores a day's
// transaction items without touching its header.

import { describe, it, expect, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { Transaction, TransactionsByDate } from '~/types/economy/wallet'

import { useTransactionActivityList } from '~/composables/economy/useTransactionActivityList'

// ── Vue reactivity as Nuxt auto-imports ──────────────────────
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

function makeTransaction(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'gift_sent',
    timestamp: '2026-07-15T10:00:00Z',
    title: 'Gift Sent',
    description: 'Sent a gift',
    status: 'completed',
    my_role: 'sender',
    amount: { value: 100, currency: 'coins', direction: 'debit' } as unknown as Transaction['amount'],
    my_balance: null,
    my_xp: null,
    other_party: null,
    metadata: {},
    ...overrides,
  }
}

function makeDay(date: string, transactionIds: string[]): TransactionsByDate {
  return {
    date,
    date_formatted: date,
    transactions: transactionIds.map(id => makeTransaction(id)),
  }
}

describe('useTransactionActivityList', () => {
  it('flattens days in order, each header followed by its own transactions', () => {
    const days = ref<TransactionsByDate[]>([
      makeDay('2026-07-15', ['a', 'b']),
      makeDay('2026-07-14', ['c']),
    ])

    const { items } = useTransactionActivityList(days)

    expect(items.value.map(i => i.type)).toEqual(['header', 'transaction', 'transaction', 'header', 'transaction'])
    expect(items.value[0]).toMatchObject({ type: 'header', date: '2026-07-15' })
    expect(items.value[1]).toMatchObject({ type: 'transaction' })
    if (items.value[1]?.type === 'transaction') expect(items.value[1].transaction.id).toBe('a')
    if (items.value[2]?.type === 'transaction') expect(items.value[2].transaction.id).toBe('b')
    expect(items.value[3]).toMatchObject({ type: 'header', date: '2026-07-14' })
    if (items.value[4]?.type === 'transaction') expect(items.value[4].transaction.id).toBe('c')
  })

  it('collapsing a day removes only that day\'s transaction items, header stays', () => {
    const days = ref<TransactionsByDate[]>([
      makeDay('2026-07-15', ['a', 'b']),
      makeDay('2026-07-14', ['c']),
    ])

    const { items, toggleDate } = useTransactionActivityList(days)

    toggleDate('2026-07-15')

    expect(items.value.map(i => i.type)).toEqual(['header', 'header', 'transaction'])
    expect(items.value[0]).toMatchObject({ type: 'header', date: '2026-07-15', collapsed: true })
    expect(items.value[1]).toMatchObject({ type: 'header', date: '2026-07-14', collapsed: false })
    if (items.value[2]?.type === 'transaction') expect(items.value[2].transaction.id).toBe('c')
  })

  it('expanding a previously collapsed day restores its transaction items', () => {
    const days = ref<TransactionsByDate[]>([makeDay('2026-07-15', ['a', 'b'])])

    const { items, toggleDate, isCollapsed } = useTransactionActivityList(days)

    toggleDate('2026-07-15')
    expect(isCollapsed('2026-07-15')).toBe(true)
    expect(items.value).toHaveLength(1)

    toggleDate('2026-07-15')
    expect(isCollapsed('2026-07-15')).toBe(false)
    expect(items.value.map(i => i.type)).toEqual(['header', 'transaction', 'transaction'])
  })

  it('produces unique keys across header and transaction items', () => {
    const days = ref<TransactionsByDate[]>([
      makeDay('2026-07-15', ['a', 'b']),
      makeDay('2026-07-14', ['c']),
    ])

    const { items } = useTransactionActivityList(days)

    const keys = items.value.map(i => i.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
