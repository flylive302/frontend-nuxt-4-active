// ========================================
// Bootstrap Store Tests — shape-version cache gate
// ========================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import { BOOTSTRAP_SHAPE_VERSION, CP_BOOTSTRAP_DEFAULTS } from '../../app/constants/bootstrap'
import type { LevelConfig } from '../../app/types/user/bootstrap'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

const level = (n: number): LevelConfig => ({
  level: n,
  name: `L${n}`,
  required_xp: n * 100,
  image_url: null,
})

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useBootstrapStore.hasUsableCache', () => {
  it('is false when levels are present but shapeVersion is null (pre-shape-version persisted state)', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.wealthLevels = [level(1)]
    store.shapeVersion = null
    expect(store.hasUsableCache).toBe(false)
  })

  it('is false when shapeVersion matches but no levels are persisted', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.wealthLevels = []
    store.charmLevels = []
    store.shapeVersion = BOOTSTRAP_SHAPE_VERSION
    expect(store.hasUsableCache).toBe(false)
  })

  it('is true when shapeVersion matches and wealth levels are present', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.wealthLevels = [level(1)]
    store.charmLevels = []
    store.shapeVersion = BOOTSTRAP_SHAPE_VERSION
    expect(store.hasUsableCache).toBe(true)
  })

  it('is true when shapeVersion matches and only charm levels are present', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.wealthLevels = []
    store.charmLevels = [level(1)]
    store.shapeVersion = BOOTSTRAP_SHAPE_VERSION
    expect(store.hasUsableCache).toBe(true)
  })
})

describe('useBootstrapStore.setConfig', () => {
  it('stamps shapeVersion to the current BOOTSTRAP_SHAPE_VERSION', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.shapeVersion = null
    store.setConfig({
      api_version: 'v1',
      room_owner_percentage: 3,
      receiver_percentage: 30,
      wealth_levels: [level(1)],
      charm_levels: [level(1)],
      room_levels: [],
      badges: [],
      gifts: [],
      vapid_public_key: null,
      props: [],
      vip_levels: [],
    })
    expect(store.shapeVersion).toBe(BOOTSTRAP_SHAPE_VERSION)
  })
})

describe('useBootstrapStore.markReadyFromCache', () => {
  it('flips idle → complete when the cache is usable', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.wealthLevels = [level(1)]
    store.shapeVersion = BOOTSTRAP_SHAPE_VERSION
    store.markReadyFromCache()
    expect(store.isReady).toBe(true)
  })

  it('stays idle on a shapeVersion mismatch even with levels present', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.wealthLevels = [level(1)]
    store.shapeVersion = null
    store.markReadyFromCache()
    expect(store.isReady).toBe(false)
  })

  it('stays idle when no levels are persisted', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.wealthLevels = []
    store.charmLevels = []
    store.shapeVersion = BOOTSTRAP_SHAPE_VERSION
    store.markReadyFromCache()
    expect(store.isReady).toBe(false)
  })
})

describe('useBootstrapStore.setEtag', () => {
  it('stores the tag verbatim, including a weak validator', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.setEtag('W/"abc"')
    expect(store.etag).toBe('W/"abc"')
  })

  it('stores null', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.setEtag('W/"abc"')
    store.setEtag(null)
    expect(store.etag).toBeNull()
  })
})

describe('useBootstrapStore.invalidateConfig("all") / reset', () => {
  it('invalidateConfig("all") nulls etag and shapeVersion', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.setEtag('W/"abc"')
    store.shapeVersion = BOOTSTRAP_SHAPE_VERSION
    store.invalidateConfig('all')
    expect(store.etag).toBeNull()
    expect(store.shapeVersion).toBeNull()
  })

  it('reset() nulls etag and shapeVersion', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.setEtag('W/"abc"')
    store.shapeVersion = BOOTSTRAP_SHAPE_VERSION
    store.reset()
    expect(store.etag).toBeNull()
    expect(store.shapeVersion).toBeNull()
  })
})

describe('useBootstrapStore cp block', () => {
  const baseConfig = {
    api_version: 'v1',
    room_owner_percentage: 3,
    receiver_percentage: 30,
    wealth_levels: [level(1)],
    charm_levels: [level(1)],
    room_levels: [],
    badges: [],
    gifts: [],
    vapid_public_key: null,
    props: [],
    vip_levels: [],
  }

  it('defaults to off when the block is absent', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.setConfig(baseConfig)
    expect(store.cpEnabled).toBe(false)
    expect(store.cpConfig).toEqual(CP_BOOTSTRAP_DEFAULTS)
  })

  it('parses a present block', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.setConfig({
      ...baseConfig,
      cp: { enabled: true, poll_seconds: 45, frame_male: 7, frame_female: 9 },
    })
    expect(store.cpEnabled).toBe(true)
    expect(store.cpConfig).toEqual({ enabled: true, poll_seconds: 45, frame_male: 7, frame_female: 9 })
  })

  it('turns off again when a later payload drops the block', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.setConfig({ ...baseConfig, cp: { enabled: true, poll_seconds: 45, frame_male: null, frame_female: null } })
    store.setConfig(baseConfig)
    expect(store.cpEnabled).toBe(false)
  })

  it('resets to off on invalidateConfig("all")', async () => {
    const { useBootstrapStore } = await import('../../app/stores/bootstrap')
    const store = useBootstrapStore()
    store.setConfig({ ...baseConfig, cp: { enabled: true, poll_seconds: 45, frame_male: null, frame_female: null } })
    store.invalidateConfig('all')
    expect(store.cpEnabled).toBe(false)
  })
})
