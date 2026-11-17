// ========================================
// useNameMotion + useVipGlint — name motion gate
// ========================================
// android-client-performance/17 fix 3: the VIP glint and scrolling name/badge
// marquees are still by default below the `high` tier; the "Names" switch
// overrides the tier both ways. Covers the toggle (flips against the EFFECTIVE
// state) and how useVipGlint derives `active` / `still` from it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

const realNavigator = globalThis.navigator

const LOW = { deviceMemory: 2 }
const HIGH = { deviceMemory: 8 }

/** Wire the Nuxt auto-imports the composables use, with a fresh store on `nav`'s tier. */
async function setup(nav: Record<string, unknown>) {
  vi.stubGlobal('navigator', nav)
  setActivePinia(createPinia())
  const { useFxPreferencesStore } = await import('../../app/stores/fxPreferences')
  const { useNameMotion } = await import('../../app/composables/vip/useNameMotion')
  const { useVipGlint } = await import('../../app/composables/vip/useVipGlint')

  const inViewport = ref(true)
  const observeEnabled = vi.fn<(enabled: () => boolean) => void>()
  vi.stubGlobal('useFxPreferencesStore', useFxPreferencesStore)
  vi.stubGlobal('useNameMotion', useNameMotion)
  vi.stubGlobal('useVipNameColor', () => ({
    vipNameColor: (level: number | null | undefined) => (level ? '#ff00aa' : ''),
  }))
  vi.stubGlobal('useInViewport', (_target: unknown, enabled: () => boolean) => {
    observeEnabled(enabled)
    return inViewport
  })

  return { store: useFxPreferencesStore(), useNameMotion, useVipGlint, inViewport, observeEnabled }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.stubGlobal('navigator', realNavigator)
  vi.unstubAllGlobals()
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('piniaPluginPersistedstate', {
    cookies: () => ({}),
    localStorage: () => ({}),
    sessionStorage: () => ({}),
  })
})

describe('useNameMotion', () => {
  it('is off by default on a low tier and on by default on a high tier', async () => {
    const weak = await setup(LOW)
    expect(weak.useNameMotion().nameMotionEnabled.value).toBe(false)

    const strong = await setup(HIGH)
    expect(strong.useNameMotion().nameMotionEnabled.value).toBe(true)
  })

  it('toggle on a still-by-default phone turns motion ON (auto is never a toggle target)', async () => {
    const { store, useNameMotion } = await setup(LOW)
    const { nameMotionEnabled, toggleNameMotion } = useNameMotion()

    toggleNameMotion()
    expect(store.animatedNames).toBe('on')
    expect(nameMotionEnabled.value).toBe(true)

    toggleNameMotion()
    expect(store.animatedNames).toBe('off')
    expect(nameMotionEnabled.value).toBe(false)
  })

  it('toggle on a high tier turns motion OFF, then back ON', async () => {
    const { store, useNameMotion } = await setup(HIGH)
    const { nameMotionEnabled, toggleNameMotion } = useNameMotion()

    toggleNameMotion()
    expect(store.animatedNames).toBe('off')
    expect(nameMotionEnabled.value).toBe(false)

    toggleNameMotion()
    expect(store.animatedNames).toBe('on')
    expect(nameMotionEnabled.value).toBe(true)
  })
})

describe('useVipGlint name motion gate', () => {
  it('still-by-default tier: VIP name is `still`, glint never active even in view', async () => {
    const { useVipGlint } = await setup(LOW)
    const g = useVipGlint(() => 2, ref(null))

    expect(g.color.value).toBe('#ff00aa')
    expect(g.inView.value).toBe(true)
    expect(g.active.value).toBe(false)
    expect(g.still.value).toBe(true)
  })

  it('high tier: VIP name in view glints, not still', async () => {
    const { useVipGlint } = await setup(HIGH)
    const g = useVipGlint(() => 2, ref(null))

    expect(g.active.value).toBe(true)
    expect(g.still.value).toBe(false)
  })

  it('high tier but off-screen: no glint, and not still either', async () => {
    const { useVipGlint, inViewport } = await setup(HIGH)
    inViewport.value = false
    const g = useVipGlint(() => 2, ref(null))

    expect(g.active.value).toBe(false)
    expect(g.still.value).toBe(false)
  })

  it('switch overrides the tier live, both ways', async () => {
    const { store, useVipGlint } = await setup(LOW)
    const g = useVipGlint(() => 2, ref(null))
    expect(g.active.value).toBe(false)

    store.setAnimatedNames('on')
    expect(g.active.value).toBe(true)
    expect(g.still.value).toBe(false)

    store.setAnimatedNames('off')
    expect(g.active.value).toBe(false)
    expect(g.still.value).toBe(true)
  })

  it('non-VIP name: never active, never still (nothing to glow)', async () => {
    for (const nav of [LOW, HIGH]) {
      const { useVipGlint } = await setup(nav)
      const g = useVipGlint(() => 0, ref(null))
      expect(g.color.value).toBe('')
      expect(g.active.value).toBe(false)
      expect(g.still.value).toBe(false)
    }
  })

  it('still observes the target for a scrolling marquee (alsoObserve), VIP or not', async () => {
    const { useVipGlint, observeEnabled } = await setup(HIGH)
    const scrolling = ref(false)
    useVipGlint(() => 0, ref(null), scrolling)

    const enabled = observeEnabled.mock.calls[0]![0]
    expect(enabled()).toBe(false)
    scrolling.value = true
    expect(enabled()).toBe(true)
  })
})
