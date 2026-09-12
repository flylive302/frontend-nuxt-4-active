import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
// homeFeed's persist config calls this at store-definition time (same
// pattern as authStore — see tests/composables/useRoomEventHandlers.spec.ts).
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

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
