// ========================================
// Bootstrap Store Tests — refresh gate
// ========================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useBootstrapStore.needsRefresh', () => {
  it('is true when the server has never reported gamesEnabled, even with a fresh timestamp', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()

    // Simulates persisted state written before gamesEnabled was persisted.
    store.lastBootstrapAt = Date.now()
    expect(store.gamesEnabled).toBeNull()
    expect(store.needsRefresh).toBe(true)
  })

  it('is false once config has been applied within the TTL', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()

    store.lastBootstrapAt = Date.now()
    store.gamesEnabled = false
    expect(store.needsRefresh).toBe(false)
  })
})

describe('useBootstrapStore.markReadyFromCache', () => {
  it('flips idle → complete when persisted level config exists, without bumping lastBootstrapAt', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.wealthLevels = [{ level: 1, name: 'L1', required_xp: 0, image_url: null }] as never
    store.lastBootstrapAt = 123
    store.markReadyFromCache()
    expect(store.isReady).toBe(true)
    expect(store.lastBootstrapAt).toBe(123)
  })

  it('stays idle when no config is persisted', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.wealthLevels = []
    store.charmLevels = []
    store.markReadyFromCache()
    expect(store.isReady).toBe(false)
  })
})
