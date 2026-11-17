import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, createApp, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

const realNavigator = globalThis.navigator

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

  // room-video-player 09 — "Always start video collapsed"
  it('defaults startVideoCollapsed to false', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    expect(store.startVideoCollapsed).toBe(false)
  })

  it('setStartVideoCollapsed updates the preference both ways', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    store.setStartVideoCollapsed(true)
    expect(store.startVideoCollapsed).toBe(true)

    store.setStartVideoCollapsed(false)
    expect(store.startVideoCollapsed).toBe(false)
  })

  it('persists startVideoCollapsed to storage and restores it on hydrate', async () => {
    const { createPersistedState } = await import('pinia-plugin-persistedstate')
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const data = new Map<string, string>([
      ['fxPreferencesStore', JSON.stringify({ startVideoCollapsed: true })],
    ])
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    }
    const pinia = createPinia()
    createApp({}).use(pinia)
    pinia.use(createPersistedState({ storage }))
    setActivePinia(pinia)

    const store = useFxPreferencesStore()
    expect(store.startVideoCollapsed).toBe(true)

    store.setStartVideoCollapsed(false)
    await Promise.resolve()
    expect(JSON.parse(data.get('fxPreferencesStore') ?? '{}').startVideoCollapsed).toBe(false)
  })

  it('mute switches default to auto', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    expect(store.muteGiftAnimations).toBe('auto')
    expect(store.muteEntryAnimations).toBe('auto')
  })

  it('setGiftMute / setEntryMute store the raw switch', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    store.setGiftMute('on')
    store.setEntryMute('off')
    expect(store.muteGiftAnimations).toBe('on')
    expect(store.muteEntryAnimations).toBe('off')
  })

  it('auto resolves through the tier; user switch wins both ways', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')

    vi.stubGlobal('navigator', { deviceMemory: 2 })
    const weak = useFxPreferencesStore()
    expect(weak.giftAnimationsMuted).toBe(true)
    expect(weak.entryAnimationsMuted).toBe(true)
    weak.setGiftMute('off')
    expect(weak.giftAnimationsMuted).toBe(false)

    setActivePinia(createPinia())
    vi.stubGlobal('navigator', { deviceMemory: 8 })
    const strong = useFxPreferencesStore()
    expect(strong.giftAnimationsMuted).toBe(false)
    expect(strong.entryAnimationsMuted).toBe(false)
    strong.setEntryMute('on')
    expect(strong.entryAnimationsMuted).toBe(true)

    vi.stubGlobal('navigator', realNavigator)
  })

  it.each([
    ['unknown (no signals)', {}],
    ['mid (4 GB)', { deviceMemory: 4 }],
  ])('%s tier keeps animations on by default', async (_label, nav) => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    vi.stubGlobal('navigator', nav)
    const store = useFxPreferencesStore()

    expect(store.giftAnimationsMuted).toBe(false)
    vi.stubGlobal('navigator', realNavigator)
  })

  it('migrates persisted legacy booleans on hydrate (false -> auto, true -> on)', async () => {
    const { createPersistedState } = await import('pinia-plugin-persistedstate')
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const data = new Map<string, string>([
      ['fxPreferencesStore', JSON.stringify({ muteGiftAnimations: true, muteEntryAnimations: false })],
    ])
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    }
    const pinia = createPinia()
    // Plugins are queued until the pinia is installed on an app.
    createApp({}).use(pinia)
    pinia.use(createPersistedState({ storage }))
    setActivePinia(pinia)

    const store = useFxPreferencesStore()
    expect(store.muteGiftAnimations).toBe('on')
    expect(store.muteEntryAnimations).toBe('auto')
  })

  // ============================================================
  // android-client-performance/17 fix 3 — animatedNames switch (VIP glint + marquees)
  // ============================================================
  it('defaults animatedNames to auto', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    expect(store.animatedNames).toBe('auto')
  })

  it('setAnimatedNames updates the raw switch both ways', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const store = useFxPreferencesStore()

    store.setAnimatedNames('on')
    expect(store.animatedNames).toBe('on')
    store.setAnimatedNames('off')
    expect(store.animatedNames).toBe('off')
    store.setAnimatedNames('auto')
    expect(store.animatedNames).toBe('auto')
  })

  it.each([
    ['low (2 GB)', { deviceMemory: 2 }],
    ['mid (4 GB)', { deviceMemory: 4 }],
    ['unknown (no signals)', {}],
  ])('auto: names are still on %s', async (_label, nav) => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    vi.stubGlobal('navigator', nav)
    const store = useFxPreferencesStore()

    expect(store.nameMotionEnabled).toBe(false)
    vi.stubGlobal('navigator', realNavigator)
  })

  it('auto: names animate on the high tier', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    vi.stubGlobal('navigator', { deviceMemory: 8 })
    const store = useFxPreferencesStore()

    expect(store.nameMotionEnabled).toBe(true)
    vi.stubGlobal('navigator', realNavigator)
  })

  it('user switch overrides the tier both ways', async () => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')

    vi.stubGlobal('navigator', { deviceMemory: 2 })
    const weak = useFxPreferencesStore()
    expect(weak.nameMotionEnabled).toBe(false)
    weak.setAnimatedNames('on')
    expect(weak.nameMotionEnabled).toBe(true)

    setActivePinia(createPinia())
    vi.stubGlobal('navigator', { deviceMemory: 8 })
    const strong = useFxPreferencesStore()
    expect(strong.nameMotionEnabled).toBe(true)
    strong.setAnimatedNames('off')
    expect(strong.nameMotionEnabled).toBe(false)

    vi.stubGlobal('navigator', realNavigator)
  })

  it.each([
    ['low', { deviceMemory: 2 }, false],
    ['high', { deviceMemory: 8 }, true],
  ])('invalid persisted animatedNames falls back to auto on %s', async (_tier, nav, expected) => {
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    vi.stubGlobal('navigator', nav)
    const store = useFxPreferencesStore()

    // Simulate a corrupt/legacy value that slipped past hydration.
    ;(store as unknown as { animatedNames: unknown }).animatedNames = 'garbage'
    expect(store.nameMotionEnabled).toBe(expected)

    ;(store as unknown as { animatedNames: unknown }).animatedNames = true
    expect(store.nameMotionEnabled).toBe(expected)
    vi.stubGlobal('navigator', realNavigator)
  })

  it('persists animatedNames to storage and restores it on hydrate', async () => {
    const { createPersistedState } = await import('pinia-plugin-persistedstate')
    const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
    const data = new Map<string, string>([
      ['fxPreferencesStore', JSON.stringify({ animatedNames: 'on' })],
    ])
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    }
    const pinia = createPinia()
    createApp({}).use(pinia)
    pinia.use(createPersistedState({ storage }))
    setActivePinia(pinia)

    const store = useFxPreferencesStore()
    expect(store.animatedNames).toBe('on')

    store.setAnimatedNames('off')
    await Promise.resolve()
    expect(JSON.parse(data.get('fxPreferencesStore') ?? '{}').animatedNames).toBe('off')
  })
})
