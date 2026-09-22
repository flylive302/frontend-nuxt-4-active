import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

beforeEach(() => {
  setActivePinia(createPinia())
})

// ============================================================
// android-client-performance/16, ADR 0039 — animatedAvatarFrames switch
// ============================================================
describe('fxPreferencesStore', () => {
  it('defaults animatedAvatarFrames to auto', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    expect(store.animatedAvatarFrames).toBe('auto')
  })

  it('setAnimatedAvatarFrames("on") updates the preference', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    store.setAnimatedAvatarFrames('on')

    expect(store.animatedAvatarFrames).toBe('on')
  })

  it('setAnimatedAvatarFrames("off") updates the preference', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    store.setAnimatedAvatarFrames('off')

    expect(store.animatedAvatarFrames).toBe('off')
  })

  it('toggleGiftMute still flips muteGiftAnimations', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    expect(store.muteGiftAnimations).toBe(false)
    store.toggleGiftMute()
    expect(store.muteGiftAnimations).toBe(true)
    store.toggleGiftMute()
    expect(store.muteGiftAnimations).toBe(false)
  })

  it('toggleEntryMute still flips muteEntryAnimations', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    expect(store.muteEntryAnimations).toBe(false)
    store.toggleEntryMute()
    expect(store.muteEntryAnimations).toBe(true)
    store.toggleEntryMute()
    expect(store.muteEntryAnimations).toBe(false)
  })
})
