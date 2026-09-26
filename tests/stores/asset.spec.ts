// ========================================
// Asset Store Tests — download progress + failure tracking
// ========================================
// The first-install download gate (critical tier, route guard, full-screen screen) was
// removed in boot-and-asset-delivery 02: static UI pictures ship in the bundle, so no
// asset is critical to first paint any more.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useAssetStore failure tracking', () => {
  it('accumulates failed URLs and the failed total', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.markFailed('https://example.com/a.svga')
    store.markFailed('https://example.com/b.mp4')

    expect(store.failedUrls).toEqual(['https://example.com/a.svga', 'https://example.com/b.mp4'])
    expect(store.failedTotal).toBe(2)
  })

  it('resetFailures clears the list and the total for a retry', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.markFailed('https://example.com/a.svga')
    store.resetFailures()

    expect(store.failedUrls).toEqual([])
    expect(store.failedTotal).toBe(0)
  })

  it('reset returns the store to idle with no progress or failures', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.setPhase('downloading')
    store.setProgress({ total: 4, completed: 1, failed: 0, currentUrl: null, bytesDownloaded: 0, bytesTotal: 0 })
    store.markFailed('https://example.com/a.svga')
    store.reset()

    expect(store.phase).toBe('idle')
    expect(store.progress).toBeNull()
    expect(store.failedTotal).toBe(0)
    expect(store.downloadPercent).toBe(0)
  })
})

describe('useAssetStore download gate removal', () => {
  it('exposes no download-gate state', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore() as unknown as Record<string, unknown>

    for (const key of ['showDownloadGate', 'isCriticalGateOpen', 'hasDegradedAssets', 'criticalTotal', 'hasCriticalFailures']) {
      expect(store[key]).toBeUndefined()
    }
  })
})
