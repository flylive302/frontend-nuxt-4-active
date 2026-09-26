import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, watch } from 'vue'
import { ASSET_CONFIG } from '../../app/constants/asset'

// ============================================================
// boot-and-asset-delivery 04 — WHEN the downloader runs, and WHAT it may
// fetch on the current network.
//  - never during cold boot: waits for the first screen to settle
//  - unmetered: full animation set; metered: evict only at boot, gifts on
//    the first room entry
//  - never without a ready catalog (a failed cold fetch discards it and the
//    catalog-diff eviction would delete every cached animation)
// ============================================================

const { mockNetwork } = vi.hoisted(() => ({
  mockNetwork: { isMeteredConnection: vi.fn(() => false) },
}))
vi.mock('~/services/networkDetector', () => mockNetwork)

const bootstrapAssets = {
  startAssetDownload: vi.fn(async () => {}),
  startRoomAssetDownload: vi.fn(async () => {}),
  evictAssets: vi.fn(async () => {}),
}

const bootstrapStore = reactive({ isReady: false })
const authStore = reactive({ token: null as string | null })
const assetStore = reactive({
  bootSettled: false,
  roomEntered: false,
  bootPassStarted: false,
  roomPassStarted: false,
  markBootSettled() { assetStore.bootSettled = true },
  markRoomEntered() { assetStore.roomEntered = true },
  markBootPassStarted() { assetStore.bootPassStarted = true },
  markRoomPassStarted() { assetStore.roomPassStarted = true },
})

vi.stubGlobal('watch', watch)
vi.stubGlobal('useBootstrapStore', () => bootstrapStore)
vi.stubGlobal('useAuthStore', () => authStore)
vi.stubGlobal('useAssetStore', () => assetStore)
vi.stubGlobal('useBootstrapAssets', () => bootstrapAssets)
// Idle slot = immediate; the start delay is what the tests drive.
vi.stubGlobal('requestIdleCallback', (cb: () => void) => { cb(); return 0 })

let scope: ReturnType<typeof effectScope> | null = null

async function install() {
  const { useAssetDeliveryPolicy } = await import('../../app/composables/shared/useAssetDeliveryPolicy')
  let policy!: ReturnType<typeof useAssetDeliveryPolicy>
  scope = effectScope()
  scope.run(() => {
    policy = useAssetDeliveryPolicy()
    policy.watchDeliveryTriggers()
  })
  return policy
}

/** Let the watcher react, then run out the pass start delay. */
async function settle(ms: number = ASSET_CONFIG.PASS_START_DELAY_MS) {
  await nextTick()
  await vi.advanceTimersByTimeAsync(ms)
}

function signedInWithCatalog() {
  authStore.token = 'token'
  bootstrapStore.isReady = true
}

beforeEach(() => {
  // Only timeouts: faking requestIdleCallback too would replace the stub above.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  bootstrapStore.isReady = false
  authStore.token = null
  assetStore.bootSettled = false
  assetStore.roomEntered = false
  assetStore.bootPassStarted = false
  assetStore.roomPassStarted = false
  mockNetwork.isMeteredConnection.mockReset().mockReturnValue(false)
  bootstrapAssets.startAssetDownload.mockClear()
  bootstrapAssets.startRoomAssetDownload.mockClear()
  bootstrapAssets.evictAssets.mockClear()
})

afterEach(() => {
  scope?.stop()
  scope = null
  vi.useRealTimers()
})

describe('boot pass — never during cold boot', () => {
  it('starts nothing while the first screen has not settled', async () => {
    signedInWithCatalog()
    await install()
    await settle(ASSET_CONFIG.BOOT_SETTLE_FALLBACK_MS - 1)

    expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()
    expect(bootstrapAssets.evictAssets).not.toHaveBeenCalled()
  })

  it('waits the start delay after home settles', async () => {
    signedInWithCatalog()
    const policy = await install()
    policy.notifyHomeSettled()
    await settle(ASSET_CONFIG.PASS_START_DELAY_MS - 1)
    expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(bootstrapAssets.startAssetDownload).toHaveBeenCalledTimes(1)
  })

  it('falls back to a timed start when the first screen never reports settled', async () => {
    signedInWithCatalog()
    await install()
    await settle(ASSET_CONFIG.BOOT_SETTLE_FALLBACK_MS)
    await settle()

    expect(bootstrapAssets.startAssetDownload).toHaveBeenCalledTimes(1)
  })
})

describe('boot pass — network policy', () => {
  it('unmetered: queues the full animation set, quietly', async () => {
    signedInWithCatalog()
    const policy = await install()
    policy.notifyHomeSettled()
    await settle()

    expect(bootstrapAssets.startAssetDownload).toHaveBeenCalledWith({ quiet: true })
    expect(bootstrapAssets.startRoomAssetDownload).not.toHaveBeenCalled()
  })

  it('metered: downloads nothing at boot but still evicts (pictures leave the bucket)', async () => {
    mockNetwork.isMeteredConnection.mockReturnValue(true)
    signedInWithCatalog()
    const policy = await install()
    policy.notifyHomeSettled()
    await settle()

    expect(bootstrapAssets.evictAssets).toHaveBeenCalledTimes(1)
    expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()
    expect(bootstrapAssets.startRoomAssetDownload).not.toHaveBeenCalled()
  })

  it('runs once per session', async () => {
    signedInWithCatalog()
    const policy = await install()
    policy.notifyHomeSettled()
    await settle()
    policy.notifyHomeSettled()
    await settle(ASSET_CONFIG.BOOT_SETTLE_FALLBACK_MS)

    expect(bootstrapAssets.startAssetDownload).toHaveBeenCalledTimes(1)
  })
})

describe('room pass', () => {
  it('metered: the first room entry queues the gift animations', async () => {
    mockNetwork.isMeteredConnection.mockReturnValue(true)
    signedInWithCatalog()
    const policy = await install()
    policy.notifyHomeSettled()
    await settle()
    policy.notifyRoomEntered()
    await settle()

    expect(bootstrapAssets.startRoomAssetDownload).toHaveBeenCalledTimes(1)
    expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()
  })

  it('a later room entry does not queue again', async () => {
    mockNetwork.isMeteredConnection.mockReturnValue(true)
    signedInWithCatalog()
    const policy = await install()
    policy.notifyRoomEntered()
    await settle()
    policy.notifyRoomEntered()
    await settle()

    expect(bootstrapAssets.startRoomAssetDownload).toHaveBeenCalledTimes(1)
  })

  it('a room entered before home settled (deep link) also opens the boot pass', async () => {
    signedInWithCatalog()
    const policy = await install()
    policy.notifyRoomEntered()
    await settle()

    expect(bootstrapAssets.startAssetDownload).toHaveBeenCalledWith({ quiet: true })
    expect(bootstrapAssets.startRoomAssetDownload).toHaveBeenCalledTimes(1)
  })
})

describe('catalog + auth gate', () => {
  // The 07 trap: a failed cold fetch discards the catalog and leaves phase at
  // 'error'. Any pass would run the catalog-diff eviction against nothing.
  it('never runs a pass while the catalog is not ready (failed cold fetch)', async () => {
    authStore.token = 'token'
    const policy = await install()
    policy.notifyHomeSettled()
    policy.notifyRoomEntered()
    await settle(ASSET_CONFIG.BOOT_SETTLE_FALLBACK_MS)
    await settle()

    expect(bootstrapAssets.evictAssets).not.toHaveBeenCalled()
    expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()
    expect(bootstrapAssets.startRoomAssetDownload).not.toHaveBeenCalled()
  })

  it('runs once the catalog becomes ready after home has settled', async () => {
    authStore.token = 'token'
    const policy = await install()
    policy.notifyHomeSettled()
    await settle()
    expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()

    bootstrapStore.isReady = true
    await settle()
    expect(bootstrapAssets.startAssetDownload).toHaveBeenCalledTimes(1)
  })

  it('never runs for a guest', async () => {
    bootstrapStore.isReady = true
    const policy = await install()
    policy.notifyHomeSettled()
    await settle(ASSET_CONFIG.BOOT_SETTLE_FALLBACK_MS)

    expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()
    expect(bootstrapAssets.evictAssets).not.toHaveBeenCalled()
  })
})
