/**
 * plugins/socket.client.ts — app-wide audio socket lifecycle.
 *
 * Locks in the EAGER connect for a restored session: the Laravel→MSAB bridge is
 * at-most-once with no replay, and bootstrap's after-first-paint user snapshot relies on
 * the socket already being live (boot-and-asset-delivery 08 tried deferring it and
 * dropped it for this reason — see the plugin header).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { BlockInfo } from '~/types/user/block'
import { ref, watch, nextTick, effectScope, type EffectScope } from 'vue'

const connect = vi.fn(() => Promise.resolve())
const disconnect = vi.fn()
const isAuthenticated = ref(false)
const maintenanceMode = ref(false)
const blockInfo = ref<BlockInfo | null>(null)

vi.stubGlobal('watch', watch)
vi.stubGlobal('defineNuxtPlugin', (def: unknown) => def)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { maintenanceMode: maintenanceMode.value } }))
vi.stubGlobal('useAudioSocket', () => ({ connect, disconnect }))
vi.stubGlobal('useAuthStore', () => ({
  get isAuthenticated() {
    return isAuthenticated.value
  },
  get blockInfo() {
    return blockInfo.value
  },
}))

let scope: EffectScope | undefined

async function setup(authenticatedAtBoot: boolean): Promise<void> {
  isAuthenticated.value = authenticatedAtBoot
  const plugin = (await import('../../app/plugins/socket.client')).default as unknown as { setup: () => void }
  scope = effectScope()
  scope.run(() => plugin.setup())
}

describe('audio-socket plugin', () => {
  beforeEach(() => {
    connect.mockClear()
    disconnect.mockClear()
    maintenanceMode.value = false
    blockInfo.value = null
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  it('restored session at cold start: connects immediately, before any after-paint work', async () => {
    await setup(true)

    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('login mid-session: connects', async () => {
    await setup(false)
    expect(connect).not.toHaveBeenCalled()

    isAuthenticated.value = true
    await nextTick()

    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('logout: disconnects', async () => {
    await setup(true)

    isAuthenticated.value = false
    await nextTick()

    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('maintenance mode: never connects', async () => {
    maintenanceMode.value = true
    await setup(true)

    expect(connect).not.toHaveBeenCalled()
  })

  it('login mid-session while blocked: does not connect', async () => {
    await setup(false)
    blockInfo.value = { kind: 'account', reason: 'Spam', until: null }

    isAuthenticated.value = true
    await nextTick()

    expect(connect).not.toHaveBeenCalled()
  })

  it('cold start with authenticated + persisted block: does not connect', async () => {
    blockInfo.value = { kind: 'account', reason: 'Spam', until: null }
    await setup(true)

    expect(connect).not.toHaveBeenCalled()
  })

  it('does not connect when the block clears (resumeAfterBlock owns that reconnect)', async () => {
    blockInfo.value = { kind: 'account', reason: 'Spam', until: null }
    await setup(true)

    blockInfo.value = null
    await nextTick()

    expect(connect).not.toHaveBeenCalled()
  })

  it('login mid-session with no block: connects (regression)', async () => {
    await setup(false)
    isAuthenticated.value = true
    await nextTick()

    expect(connect).toHaveBeenCalledTimes(1)
  })
})
