/**
 * useAuthStore.applyBalance — sequence-guarded balance setter
 * (gift-authority-tick-fanout ticket 13). Older `seq` must never win, and a
 * partial patch (only `coins`) must never wipe the fields it didn't carry.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('useCookie', () => ref(null))
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

describe('useAuthStore.applyBalance', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function setup() {
    const { useAuthStore } = await import('../../app/stores/auth')
    const store = useAuthStore()
    store.user = {
      id: 1,
      coins: '1000',
      diamonds: '50',
      wealth_xp: '10',
      charm_xp: '5',
    } as never
    return store
  }

  it('applies a balance whose seq is newer than the last applied one', async () => {
    const store = await setup()

    store.applyBalance({ coins: '900', seq: 1 })

    expect(store.user?.coins).toBe('900')
  })

  it('ignores a seq that is not newer (older or equal) than the last applied one', async () => {
    const store = await setup()

    store.applyBalance({ coins: '900', seq: 5 })
    store.applyBalance({ coins: '999999', seq: 5 }) // equal — ignored
    store.applyBalance({ coins: '1', seq: 2 }) // older — ignored

    expect(store.user?.coins).toBe('900')
  })

  it('ack-then-push and push-then-ack converge on the same number', async () => {
    // Two DIFFERENT messages (seq 5 then seq 6) applied in both possible
    // arrival orders must land on the SAME final number — seq 6's value,
    // since it is the newer one regardless of which order it arrives in.
    const ackThenPush = await setup()
    ackThenPush.applyBalance({ coins: '900', seq: 5 }) // ack arrives first
    ackThenPush.applyBalance({ coins: '850', seq: 6 }) // push arrives second, newer — applies
    expect(ackThenPush.user?.coins).toBe('850')

    // Fresh pinia instance: otherwise `setup()` would hand back the SAME
    // singleton store `ackThenPush` already used above.
    setActivePinia(createPinia())
    const pushThenAck = await setup()
    pushThenAck.applyBalance({ coins: '850', seq: 6 }) // push arrives first
    pushThenAck.applyBalance({ coins: '900', seq: 5 }) // stale ack arrives second — ignored
    expect(pushThenAck.user?.coins).toBe('850')

    expect(ackThenPush.user?.coins).toBe(pushThenAck.user?.coins)
  })

  it('only patches the keys present — a coins-only apply leaves diamonds/XP untouched', async () => {
    const store = await setup()

    store.applyBalance({ coins: '850', seq: 1 })

    expect(store.user?.coins).toBe('850')
    expect(store.user?.diamonds).toBe('50')
    expect(store.user?.wealth_xp).toBe('10')
    expect(store.user?.charm_xp).toBe('5')
  })

  it('seq: 0 is a no-op against the default watermark — strictly-greater, not greater-or-equal', async () => {
    const store = await setup()

    // lastBalanceSeq defaults to 0 — seq 0 is NOT newer, so it is a no-op.
    store.applyBalance({ coins: '1', seq: 0 })
    expect(store.user?.coins).toBe('1000')

    // seq 1 is newer and applies.
    store.applyBalance({ coins: '2', seq: 1 })
    expect(store.user?.coins).toBe('2')
  })

  it('setUser to a DIFFERENT user id resets the watermark (login without an explicit logout() first)', async () => {
    const store = await setup()
    store.applyBalance({ coins: '1', seq: 100 })
    expect(store.lastBalanceSeq).toBe(100)

    store.setUser({ id: 2, coins: '1000', diamonds: '0', wealth_xp: '0', charm_xp: '0' } as never)
    expect(store.lastBalanceSeq).toBe(0)
  })

  it('setUser for the SAME user id (self-heal resync) leaves the watermark alone', async () => {
    const store = await setup()
    store.applyBalance({ coins: '1', seq: 100 })

    store.setUser({ id: 1, coins: '1000', diamonds: '0', wealth_xp: '0', charm_xp: '0' } as never)
    expect(store.lastBalanceSeq).toBe(100)
  })

  it('logout resets the watermark so a fresh session is not blocked by the old high seq', async () => {
    const store = await setup()
    store.applyBalance({ coins: '1', seq: 100 })
    expect(store.lastBalanceSeq).toBe(100)

    store.logout()
    expect(store.lastBalanceSeq).toBe(0)
  })
})
