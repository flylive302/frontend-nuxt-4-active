/**
 * plugins/balance-seed.client.ts — the one cross-store hop from `auth.user`
 * identity to the in-memory balance store.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('useCookie', () => ref(null))
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})
vi.stubGlobal('defineNuxtPlugin', (fn: () => void) => fn)

const user = (id: number, coins = '1000') =>
  ({ id, coins, diamonds: '50', wealth_xp: '10', charm_xp: '5' }) as never

describe('balance-seed plugin', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function setup(persistedUser: unknown) {
    const { useAuthStore } = await import('../../app/stores/auth')
    const { useBalanceStore } = await import('../../app/stores/balance')
    vi.stubGlobal('useAuthStore', useAuthStore)
    vi.stubGlobal('useBalanceStore', useBalanceStore)
    const authStore = useAuthStore()
    const balanceStore = useBalanceStore()
    authStore.user = persistedUser as never
    const plugin = (await import('../../app/plugins/balance-seed.client')).default as unknown as () => void
    plugin()
    return { authStore, balanceStore }
  }

  it('cold start: seeds from the persisted user immediately', async () => {
    const { balanceStore } = await setup(user(1, '777'))
    expect(balanceStore.coins).toBe('777')
    expect(balanceStore.seq).toBe(0)
  })

  it('login after a cold start with no user seeds once the user lands', async () => {
    const { authStore, balanceStore } = await setup(null)
    expect(balanceStore.isSeeded).toBe(false)
    authStore.setUser(user(1, '10'))
    await nextTick()
    expect(balanceStore.coins).toBe('10')
  })

  it('user switch resets the watermark and reseeds', async () => {
    const { authStore, balanceStore } = await setup(user(1))
    balanceStore.apply({ coins: '1', seq: 100 })
    authStore.setUser(user(2, '5'))
    await nextTick()
    expect(balanceStore.seq).toBe(0)
    expect(balanceStore.coins).toBe('5')
  })

  it('same-user resync does NOT reseed or touch the watermark', async () => {
    const { authStore, balanceStore } = await setup(user(1))
    balanceStore.apply({ coins: '1', seq: 100 })
    authStore.setUser(user(1, '999'))
    await nextTick()
    expect(balanceStore.seq).toBe(100)
    expect(balanceStore.coins).toBe('1')
  })

  it('logout resets everything', async () => {
    const { authStore, balanceStore } = await setup(user(1))
    balanceStore.apply({ coins: '1', seq: 100 })
    authStore.logout()
    await nextTick()
    expect(balanceStore.isSeeded).toBe(false)
    expect(balanceStore.seq).toBe(0)
  })
})
