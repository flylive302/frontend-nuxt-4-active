// ========================================
// Asset Store Tests — critical gate logic
// ========================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

// ============================================================
// isCriticalGateOpen
// ============================================================

describe('useAssetStore.isCriticalGateOpen', () => {
  it('opens when criticalSucceeded reaches criticalTotal', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.setCriticalTotal(3)
    store.markCriticalSucceeded()
    store.markCriticalSucceeded()
    store.markCriticalSucceeded()

    expect(store.isCriticalGateOpen).toBe(true)
  })

  it('stays closed on partial success', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.setCriticalTotal(3)
    store.markCriticalSucceeded()
    store.markCriticalSucceeded()

    expect(store.isCriticalGateOpen).toBe(false)
  })

  it('stays closed when criticalTotal === 0 (bootstrap not yet started)', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    expect(store.criticalTotal).toBe(0)
    expect(store.isCriticalGateOpen).toBe(false)
  })

  it('opens via cacheSweptAndConfirmed regardless of counters', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.setCacheSweptAndConfirmed(true)

    expect(store.isCriticalGateOpen).toBe(true)
  })

  it('non-critical failures do not open or close the gate', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.setCriticalTotal(1)
    store.markFailed('https://example.com/normal.webm')

    expect(store.isCriticalGateOpen).toBe(false)
    expect(store.hasCriticalFailures).toBe(false)
  })
})

// ============================================================
// hasCriticalFailures
// ============================================================

describe('useAssetStore.hasCriticalFailures', () => {
  it('is true when a critical asset exhausts retries', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.markCriticalFailed('https://example.com/critical.webm')

    expect(store.hasCriticalFailures).toBe(true)
  })

  it('stays false when only non-critical assets fail', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.markFailed('https://example.com/non-critical.webm')

    expect(store.hasCriticalFailures).toBe(false)
  })

  it('criticalFailedUrls and failedUrls accumulate correctly', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.markCriticalFailed('https://example.com/c1.webm')
    store.markFailed('https://example.com/c1.webm')
    store.markFailed('https://example.com/n1.webm')

    expect(store.criticalFailedUrls).toEqual(['https://example.com/c1.webm'])
    expect(store.failedUrls).toEqual(['https://example.com/c1.webm', 'https://example.com/n1.webm'])
    expect(store.failedTotal).toBe(2)
    expect(store.criticalFailed).toBe(1)
  })

  it('resetFailedUrls clears both URL lists', async () => {
    const { useAssetStore } = await import('../../app/stores/asset')
    const store = useAssetStore()

    store.markCriticalFailed('https://example.com/c1.webm')
    store.markFailed('https://example.com/n1.webm')
    store.resetFailedUrls()

    expect(store.criticalFailedUrls).toEqual([])
    expect(store.failedUrls).toEqual([])
  })
})
