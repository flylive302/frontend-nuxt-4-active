/**
 * usePresenceStore (dm-realtime-platform/07) — ephemeral online/offline
 * state for subscribed DM contacts. State-only: setters, no API/socket code.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

vi.stubGlobal('ref', ref)

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('usePresenceStore', () => {
  it('setOnline sets a single user online/offline', async () => {
    const { usePresenceStore } = await import('../../app/stores/presence')
    const store = usePresenceStore()

    store.setOnline(7, true)
    expect(store.onlineByUserId[7]).toBe(true)

    store.setOnline(7, false)
    expect(store.onlineByUserId[7]).toBe(false)
  })

  it('applySnapshot merges a batch of online states without clobbering others', async () => {
    const { usePresenceStore } = await import('../../app/stores/presence')
    const store = usePresenceStore()

    store.setOnline(1, true)
    store.applySnapshot({ 2: true, 3: false })

    expect(store.onlineByUserId).toEqual({ 1: true, 2: true, 3: false })
  })

  it('setSubscriptions replaces the subscribed id set', async () => {
    const { usePresenceStore } = await import('../../app/stores/presence')
    const store = usePresenceStore()

    store.setSubscriptions([1, 2, 3])
    expect(store.subscribedUserIds).toEqual(new Set([1, 2, 3]))

    store.setSubscriptions([4])
    expect(store.subscribedUserIds).toEqual(new Set([4]))
  })

  it('$reset clears online map and subscriptions', async () => {
    const { usePresenceStore } = await import('../../app/stores/presence')
    const store = usePresenceStore()

    store.setOnline(1, true)
    store.setSubscriptions([1])
    store.$reset()

    expect(store.onlineByUserId).toEqual({})
    expect(store.subscribedUserIds).toEqual(new Set())
  })
})
