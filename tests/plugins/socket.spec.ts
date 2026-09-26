/**
 * plugins/socket.client.ts — app-wide audio socket lifecycle.
 *
 * Locks in the EAGER connect for a restored session: the Laravel→MSAB bridge is
 * at-most-once with no replay, and bootstrap's after-first-paint user snapshot relies on
 * the socket already being live (boot-and-asset-delivery 08 tried deferring it and
 * dropped it for this reason — see the plugin header).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, watch, nextTick, effectScope, type EffectScope } from 'vue'

const connect = vi.fn(() => Promise.resolve())
const disconnect = vi.fn()
const isAuthenticated = ref(false)
const maintenanceMode = ref(false)

vi.stubGlobal('watch', watch)
vi.stubGlobal('defineNuxtPlugin', (def: unknown) => def)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { maintenanceMode: maintenanceMode.value } }))
vi.stubGlobal('useAudioSocket', () => ({ connect, disconnect }))
vi.stubGlobal('useAuthStore', () => ({
  get isAuthenticated() {
    return isAuthenticated.value
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
})
