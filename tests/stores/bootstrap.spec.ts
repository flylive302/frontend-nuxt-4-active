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
