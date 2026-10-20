import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import type { CpPairCard, CpWeekMeta } from '../../app/types/cp'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

function pair(id: number): CpPairCard {
  const user = { id, name: 'n', signature: 's', avatar: null, vip_level: 0, gender: null, frame_id: null }
  return {
    pair_id: id, binder: user, partner: { ...user, id: id + 1000 }, bound_at: '2026-01-01T00:00:00Z',
    days: 1, lifetime_intimacy: 10, weekly_score: 1, lifetime_rank: null, weekly_rank: null,
  }
}

const week = (key: string): CpWeekMeta => ({ week_key: key, closes_at: '2026-10-26T02:00:00+05:00', server_time: '2026-10-19T10:00:00+05:00' })

describe('cp store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  async function makeStore() {
    const { useCpStore } = await import('../../app/stores/cp')
    return useCpStore()
  }

  it('setList stores podium, rows, cursor and week', async () => {
    const store = await makeStore()
    store.setList([pair(1)], [pair(4), pair(5)], 20, week('2026-W43'))
    expect(store.podium).toHaveLength(1)
    expect(store.rows.map(p => p.pair_id)).toEqual([4, 5])
    expect(store.nextOffset).toBe(20)
    expect(store.weekKey).toBe('2026-W43')
    expect(store.isEmpty).toBe(false)
  })

  it('appendRows dedupes by pair_id and updates the cursor', async () => {
    const store = await makeStore()
    store.setList([], [pair(4), pair(5)], 20, week('2026-W43'))
    store.appendRows([pair(5), pair(6)], null)
    expect(store.rows.map(p => p.pair_id)).toEqual([4, 5, 6])
    expect(store.nextOffset).toBeNull()
  })

  it('mergeHead refreshes the head but keeps deeper scrolled rows', async () => {
    const store = await makeStore()
    store.setList([pair(1)], [pair(4), pair(5)], 2, week('2026-W43'))
    store.appendRows([pair(6), pair(7)], 4)
    store.mergeHead([pair(2)], [pair(5), pair(4)], 2, week('2026-W43'))
    expect(store.podium.map(p => p.pair_id)).toEqual([2])
    expect(store.rows.map(p => p.pair_id)).toEqual([5, 4, 6, 7])
    expect(store.nextOffset).toBe(4)
  })

  it('isEmpty only after a load with no pairs', async () => {
    const store = await makeStore()
    expect(store.isEmpty).toBe(false)
    store.setList([], [], null, week('2026-W43'))
    expect(store.isEmpty).toBe(true)
  })

  it('resetEvent keeps cached profiles', async () => {
    const store = await makeStore()
    store.setProfile('abc', { user: pair(1).binder, top_pair: null, pairs: [] })
    store.setList([pair(1)], [], null, week('2026-W43'))
    store.resetEvent()
    expect(store.podium).toEqual([])
    expect(store.profileFor('abc')).not.toBeNull()
  })

  it('bumpRoomBindingGiftSignal increments roomBindingGiftSignal', async () => {
    const store = await makeStore()
    expect(store.roomBindingGiftSignal).toBe(0)
    store.bumpRoomBindingGiftSignal()
    store.bumpRoomBindingGiftSignal()
    expect(store.roomBindingGiftSignal).toBe(2)
  })
})
