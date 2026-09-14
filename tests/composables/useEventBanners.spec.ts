// ========================================
// useEventBanners Composable Tests
// ========================================
//
// discover-events-page-audit/01 step 4: the failure warn used to live inside
// the `banners` computed, so it fired on every re-read while `error` was set
// and never fired if nothing read `banners`. It is now a `watch(error)`.
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed, watch, nextTick } from 'vue'
import type { BannersApiResponse } from '~/types/banner'

const warn = vi.fn()
vi.mock('~/utils/logger', () => ({ createLogger: () => ({ warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }) }))

// Fresh refs per test: each `useEventBanners()` call installs a `watch(error)`,
// so a shared ref would let an earlier test's instance fire too.
let data = ref<{ res: BannersApiResponse; fetchedAt?: number } | null>(null)
let error = ref<unknown>(null)

function setupGlobals() {
  data = ref(null)
  error = ref(null)
  const g = globalThis as Record<string, unknown>
  g.ref = ref
  g.computed = computed
  g.watch = watch
  g.onMounted = vi.fn()
  g.useAsyncData = () => ({ data, pending: ref(false), error, refresh: vi.fn() })
}

function cleanupGlobals() {
  for (const k of ['ref', 'computed', 'watch', 'onMounted', 'useAsyncData']) Reflect.deleteProperty(globalThis, k)
}

describe('useEventBanners', () => {
  beforeEach(() => {
    warn.mockClear()
    setupGlobals()
  })
  afterEach(cleanupGlobals)

  it('maps API items to client banners with the ImageKit transform applied', async () => {
    const { useEventBanners } = await import('~/composables/events/useEventBanners')
    const { banners } = useEventBanners()
    data.value = { res: { status: 'success', message: '', data: [{ id: 7, image_url: 'https://ik/x.png', navigate_to: '/room/1', position: 0 }] } }
    expect(banners.value).toEqual([{ id: 7, banner: expect.stringMatching(/^https:\/\/ik\/x\.png\?tr=/), navigateTo: '/room/1' }])
  })

  it('warns once per failure, not once per read of `banners`', async () => {
    const { useEventBanners } = await import('~/composables/events/useEventBanners')
    const { banners } = useEventBanners()

    error.value = new Error('boom')
    await nextTick()
    expect(warn).toHaveBeenCalledTimes(1)

    // Reading the computed repeatedly must not log again.
    expect(banners.value).toEqual([])
    expect(banners.value).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('does not warn when there is simply no data yet', async () => {
    const { useEventBanners } = await import('~/composables/events/useEventBanners')
    const { banners } = useEventBanners()
    expect(banners.value).toEqual([])
    await nextTick()
    expect(warn).not.toHaveBeenCalled()
  })
})
