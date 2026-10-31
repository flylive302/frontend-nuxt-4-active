// ========================================
// useApi — the 401 branch (account-bans 03)
// ========================================
// No other spec exercises useApi itself (every spec mocks it). This one drives
// the real onResponseError hook captured from ofetch.create().

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FetchContext } from 'ofetch'

import { useApi } from '~/composables/shared/useApi'

const { createdOptions } = vi.hoisted(() => ({
  createdOptions: [] as Array<{ onResponseError?: (ctx: FetchContext) => void; onResponse?: (ctx: FetchContext) => void; onRequest?: (ctx: FetchContext) => void }>,
}))

vi.mock('ofetch', () => ({
  ofetch: {
    create: (opts: { onResponseError?: (ctx: FetchContext) => void; onResponse?: (ctx: FetchContext) => void; onRequest?: (ctx: FetchContext) => void }) => {
      createdOptions.push(opts)
      return vi.fn()
    },
  },
}))

vi.mock('~/composables/shared/useClientInfo', () => ({ getClientType: () => 'web' }))
vi.mock('~/composables/shared/useDeviceId', () => ({ useDeviceId: () => 'device-1' }))

const mockEnterBlocked = vi.fn()
const mockLogout = vi.fn()
const mockNavigateTo = vi.fn()
const mockToastAdd = vi.fn()
const mockResume = vi.fn()
const authStore = { token: 'tok' as string | null, blockInfo: null as unknown, logout: mockLogout }

vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'https://api.test/api' } }))
vi.stubGlobal('useBlockedState', () => ({ enterBlocked: mockEnterBlocked, resumeAfterBlock: mockResume }))
vi.stubGlobal('useAuthStore', () => authStore)
vi.stubGlobal('navigateTo', mockNavigateTo)
vi.stubGlobal('useToast', () => ({ add: mockToastAdd }))
vi.stubGlobal('useCookie', () => ({ value: null }))
vi.stubGlobal('useConnectivityStore', () => ({ recordFailure: vi.fn(), resetFailures: vi.fn() }))

function hook() {
  useApi()
  const opts = createdOptions.at(-1)
  if (!opts?.onResponseError) throw new Error('onResponseError not captured')
  return opts.onResponseError
}

function fire(status: number, url: string, data: unknown) {
  hook()({ response: { status, url, _data: data } } as unknown as FetchContext)
}

const blocked = (code: string, extra: Record<string, unknown> = {}) => ({
  success: false,
  message: 'Your account is blocked.',
  meta: { error_code: code, reason: null, blocked_until: null, ...extra },
})

describe('useApi onResponseError — blocked replies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStore.token = 'tok'
    authStore.blockInfo = null
  })

  it.each(['/auth/user', '/bootstrap', '/msab-token/refresh', '/rooms'])(
    'ACCOUNT_BLOCKED on %s → /blocked with reason and end date, token kept',
    (path) => {
      fire(401, `https://api.test/api${path}`, blocked('ACCOUNT_BLOCKED', { reason: 'Spam', blocked_until: '2026-11-02T10:00:00+00:00' }))

      expect(mockEnterBlocked).toHaveBeenCalledWith({ kind: 'account', reason: 'Spam', until: '2026-11-02T10:00:00+00:00' })
      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockNavigateTo).not.toHaveBeenCalledWith('/log-in')
    },
  )

  it.each([
    ['IP_BLOCKED', 'ip'],
    ['DEVICE_BLOCKED', 'device'],
  ] as const)('%s → /blocked as %s, no reason', (code, kind) => {
    fire(401, 'https://api.test/api/rooms', blocked(code, { reason: 'x' }))
    expect(mockEnterBlocked).toHaveBeenCalledWith({ kind, reason: null, until: null })
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('signed out (login refused by an IP block) still lands on /blocked', () => {
    authStore.token = null
    fire(401, 'https://api.test/api/auth/login', blocked('IP_BLOCKED'))
    expect(mockEnterBlocked).toHaveBeenCalledOnce()
  })

  it('a plain 401 with no code → "Session ended" + logout, unchanged', () => {
    fire(401, 'https://api.test/api/rooms', { success: false, message: 'Unauthenticated.' })
    expect(mockEnterBlocked).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Session ended' }))
    expect(mockLogout).toHaveBeenCalledOnce()
    expect(mockNavigateTo).toHaveBeenCalledWith('/log-in')
  })

  it('a plain 401 on an exempt URL stays silent, unchanged', () => {
    fire(401, 'https://api.test/api/bootstrap', { message: 'Unauthenticated.' })
    expect(mockEnterBlocked).not.toHaveBeenCalled()
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it("a Room Block's 403 user_blocked never reaches /blocked", () => {
    fire(403, 'https://api.test/api/rooms/1/join', { message: 'Blocked from room', meta: { error_code: 'user_blocked' } })
    expect(mockEnterBlocked).not.toHaveBeenCalled()
    expect(mockLogout).not.toHaveBeenCalled()
  })
})

describe('useApi onResponse — resuming after a block', () => {
  /** Send (onRequest) then answer (onResponse) one request, with its own options object. */
  function roundTrip(ok: boolean, url: string, blockedAtSend: unknown, blockedAtReply: unknown = blockedAtSend) {
    useApi()
    const { onRequest, onResponse } = createdOptions.at(-1) ?? {}
    if (!onRequest || !onResponse) throw new Error('hooks not captured')
    const options = { headers: {} }
    authStore.blockInfo = blockedAtSend
    onRequest({ options } as unknown as FetchContext)
    authStore.blockInfo = blockedAtReply
    onResponse({ options, response: { ok, status: ok ? 200 : 401, url } } as unknown as FetchContext)
  }

  const IP = { kind: 'ip', reason: null, until: null }

  beforeEach(() => vi.clearAllMocks())

  it('a 2xx /auth/user sent while a block is stored resumes the session', () => {
    roundTrip(true, 'https://api.test/api/v1/auth/user', IP)
    expect(mockResume).toHaveBeenCalledOnce()
  })

  it('a stale 2xx — sent before the block landed — does not clear it', () => {
    roundTrip(true, 'https://api.test/api/v1/auth/user', null, IP)
    expect(mockResume).not.toHaveBeenCalled()
  })

  it('other URLs, failed replies, or no stored block → nothing', () => {
    roundTrip(true, 'https://api.test/api/v1/bootstrap', IP)
    roundTrip(false, 'https://api.test/api/v1/auth/user', IP)
    roundTrip(true, 'https://api.test/api/v1/auth/user', null)
    expect(mockResume).not.toHaveBeenCalled()
  })
})
