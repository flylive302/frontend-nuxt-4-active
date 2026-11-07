import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
// homeFeed persists through `seededLocalStorage(...)` (ADR 0048), which only
// touches localStorage when the persist plugin runs — not installed here.
// Persistence is covered in tests/stores/persistedStores.legacySeed.spec.ts.

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('homeFeedStore.setCountry', () => {
  it('sets the selected country', async () => {
    const { useHomeFeedStore } = await import('../../app/stores/homeFeed')
    const store = useHomeFeedStore()

    store.setCountry('US')

    expect(store.selectedCountry).toBe('US')
  })

  it('defaults to the unfiltered "All" list', async () => {
    const { useHomeFeedStore } = await import('../../app/stores/homeFeed')
    const store = useHomeFeedStore()

    expect(store.selectedCountry).toBe('')
  })
})

describe('homeFeedStore.resetToAll', () => {
  it('clears the selected country back to ""', async () => {
    const { useHomeFeedStore } = await import('../../app/stores/homeFeed')
    const store = useHomeFeedStore()
    store.setCountry('US')

    store.resetToAll()

    expect(store.selectedCountry).toBe('')
  })

  it('does not touch rateLimitedUntil', async () => {
    const { useHomeFeedStore } = await import('../../app/stores/homeFeed')
    const store = useHomeFeedStore()
    store.setCountry('US')
    store.setRateLimitedUntil(123)

    store.resetToAll()

    expect(store.rateLimitedUntil).toBe(123)
  })
})

describe('homeFeedStore.setLiveOnly', () => {
  it('defaults to ON so a first landing shows only live rooms', async () => {
    const { useHomeFeedStore } = await import('../../app/stores/homeFeed')
    expect(useHomeFeedStore().liveOnly).toBe(true)
  })

  it('switches to all rooms', async () => {
    const { useHomeFeedStore } = await import('../../app/stores/homeFeed')
    const store = useHomeFeedStore()
    store.setLiveOnly(false)
    expect(store.liveOnly).toBe(false)
  })

  it('is untouched by resetToAll', async () => {
    const { useHomeFeedStore } = await import('../../app/stores/homeFeed')
    const store = useHomeFeedStore()
    store.setLiveOnly(false)
    store.resetToAll()
    expect(store.liveOnly).toBe(false)
  })
})
