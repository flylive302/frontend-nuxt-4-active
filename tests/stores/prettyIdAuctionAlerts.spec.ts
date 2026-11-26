import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readonly, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)

async function makeStore() {
  const { usePrettyIdAuctionAlertsStore } = await import('../../app/stores/prettyIdAuctionAlerts')
  return usePrettyIdAuctionAlertsStore()
}

describe('prettyIdAuctionAlerts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts on (the server default), not loaded, not saving', async () => {
    const store = await makeStore()
    expect(store.enabled).toBe(true)
    expect(store.isLoaded).toBe(false)
    expect(store.isSaving).toBe(false)
  })

  it('setEnabled changes the value without marking it loaded', async () => {
    const store = await makeStore()
    store.setEnabled(false)
    expect(store.enabled).toBe(false)
    expect(store.isLoaded).toBe(false)
  })

  it('setServerEnabled stores the server value and marks it loaded', async () => {
    const store = await makeStore()
    store.setServerEnabled(false)
    expect(store.enabled).toBe(false)
    expect(store.isLoaded).toBe(true)
  })

  it('reset returns to the defaults', async () => {
    const store = await makeStore()
    store.setServerEnabled(false)
    store.setSaving(true)
    store.reset()
    expect(store.enabled).toBe(true)
    expect(store.isLoaded).toBe(false)
    expect(store.isSaving).toBe(false)
  })
})
