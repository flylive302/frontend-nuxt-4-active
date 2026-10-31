// ========================================
// blocked.global middleware Tests (account-bans 03)
// ========================================
// The stored block survives a kill + relaunch: the first navigation after a
// relaunch lands on /blocked before any API call comes back.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = { blockInfo: null as unknown, maintenanceMode: false }
const mockNavigateTo = vi.fn((path: string) => `redirect:${path}`)

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('useAuthStore', () => ({ blockInfo: state.blockInfo }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { maintenanceMode: state.maintenanceMode } }))
vi.stubGlobal('navigateTo', mockNavigateTo)

const { default: middleware } = await import('~/middleware/blocked.global')
const run = (path: string) => (middleware as (to: { path: string }) => unknown)({ path })

describe('blocked.global', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.blockInfo = null
    state.maintenanceMode = false
  })

  it('no stored block → every route is reachable', () => {
    expect(run('/')).toBeUndefined()
    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  it('stored block → any route lands on /blocked (replace)', () => {
    state.blockInfo = { kind: 'device', reason: null, until: null }
    expect(run('/rooms/12')).toBe('redirect:/blocked')
    expect(mockNavigateTo).toHaveBeenCalledWith('/blocked', { replace: true })
  })

  it('stored block → /blocked itself (with or without a trailing slash) is not redirected', () => {
    state.blockInfo = { kind: 'ip', reason: null, until: null }
    expect(run('/blocked')).toBeUndefined()
    expect(run('/blocked/')).toBeUndefined()
  })

  it('maintenance build → steps aside so the two walls never loop', () => {
    state.blockInfo = { kind: 'account', reason: null, until: null }
    state.maintenanceMode = true
    expect(run('/maintenance')).toBeUndefined()
  })
})
