// ========================================
// useBlockedState Tests (account-bans 03)
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BlockInfo } from '~/types/user/block'

import { useBlockedState } from '~/composables/auth/useBlockedState'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

const authStore = {
  token: 'tok' as string | null,
  blockInfo: null as BlockInfo | null,
  setBlockInfo: vi.fn((info: BlockInfo | null) => { authStore.blockInfo = info }),
}
const mockApi = vi.fn()
const mockNavigateTo = vi.fn()
const mockLogout = vi.fn()
const mockInit = vi.fn()
const route = { path: '/rooms' }

vi.stubGlobal('useAuthStore', () => authStore)
vi.stubGlobal('useApi', () => ({ api: mockApi }))
vi.stubGlobal('navigateTo', mockNavigateTo)
vi.stubGlobal('useAuthActions', () => ({ logout: mockLogout }))
vi.stubGlobal('useBootstrapInit', () => ({ init: mockInit }))
vi.stubGlobal('useRoute', () => route)
const mockLeaveRoom = vi.fn()
const mockDisconnect = vi.fn()
const mockConnect = vi.fn()
const socket = { isConnected: { value: false }, connect: mockConnect, disconnect: mockDisconnect }
vi.stubGlobal('useRoomSession', () => ({ leaveRoom: mockLeaveRoom }))
vi.stubGlobal('useAudioSocket', () => socket)
const mockToastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: mockToastAdd }))
vi.stubGlobal('computed', (fn: () => unknown) => ({ get value() { return fn() } }))
vi.stubGlobal('ref', <T>(v: T) => ({ value: v }))

const ACCOUNT: BlockInfo = { kind: 'account', reason: 'Spam', until: '2026-11-02T10:00:00Z' }

describe('useBlockedState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStore.token = 'tok'
    authStore.blockInfo = null
    route.path = '/rooms'
    socket.isConnected.value = false
  })

  describe('enterBlocked', () => {
    it('stores the block and lands on /blocked, keeping the token', () => {
      useBlockedState().enterBlocked(ACCOUNT)

      expect(authStore.setBlockInfo).toHaveBeenCalledWith(ACCOUNT)
      expect(mockNavigateTo).toHaveBeenCalledWith('/blocked', { replace: true })
      expect(authStore.token).toBe('tok')
      expect(mockLogout).not.toHaveBeenCalled()
    })

    it('first entry leaves the room and drops the live connection; later replies do not repeat it', () => {
      const { enterBlocked } = useBlockedState()
      enterBlocked(ACCOUNT)
      enterBlocked(ACCOUNT)

      expect(mockLeaveRoom).toHaveBeenCalledOnce()
      expect(mockDisconnect).toHaveBeenCalledOnce()
    })

    it('a teardown that throws still lands the user on /blocked', () => {
      mockLeaveRoom.mockImplementationOnce(() => { throw new Error('boom') })
      expect(() => useBlockedState().enterBlocked(ACCOUNT)).not.toThrow()
      expect(mockNavigateTo).toHaveBeenCalledWith('/blocked', { replace: true })
    })

    it('already on /blocked: refreshes the stored block without navigating again', () => {
      route.path = '/blocked'
      const updated = { ...ACCOUNT, until: '2026-11-05T10:00:00Z' }

      useBlockedState().enterBlocked(updated)

      expect(authStore.blockInfo).toEqual(updated)
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })
  })

  describe('tryAgain', () => {
    beforeEach(() => { authStore.blockInfo = ACCOUNT })

    it('success → clears the block, re-runs bootstrap and resumes with the same token', async () => {
      mockApi.mockResolvedValue({ data: {} })

      await useBlockedState().tryAgain()

      expect(mockApi).toHaveBeenCalledWith('/auth/user')
      expect(authStore.blockInfo).toBeNull()
      expect(mockInit).toHaveBeenCalledOnce()
      expect(mockConnect).toHaveBeenCalledOnce()
      expect(authStore.token).toBe('tok')
      expect(mockLogout).not.toHaveBeenCalled()
    })

    it('still blocked → stays on /blocked (useApi re-stored the block), no logout', async () => {
      mockApi.mockRejectedValue({
        response: { status: 401, _data: { meta: { error_code: 'ACCOUNT_BLOCKED', reason: 'Spam', blocked_until: null } } },
      })

      await useBlockedState().tryAgain()

      expect(authStore.blockInfo).toEqual(ACCOUNT)
      expect(mockNavigateTo).not.toHaveBeenCalled()
      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('plain 401 (token gone) → logs out instead of leaving a dead Try again', async () => {
      mockApi.mockRejectedValue({ response: { status: 401, _data: { message: 'Unauthenticated.' } } })

      await useBlockedState().tryAgain()

      expect(mockLogout).toHaveBeenCalledOnce()
    })

    it('network failure → stays put, no logout', async () => {
      mockApi.mockRejectedValue(new TypeError('fetch failed'))

      await useBlockedState().tryAgain()

      expect(authStore.blockInfo).toEqual(ACCOUNT)
      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not reach FlyLive' }))
    })

    it('signed out → does nothing', async () => {
      authStore.token = null
      await useBlockedState().tryAgain()
      expect(mockApi).not.toHaveBeenCalled()
    })
  })

  describe('resumeAfterBlock', () => {
    it('nothing stored → no-op', () => {
      useBlockedState().resumeAfterBlock()
      expect(mockInit).not.toHaveBeenCalled()
      expect(mockConnect).not.toHaveBeenCalled()
    })

    it('on /blocked → clears, re-runs bootstrap, reconnects and goes home', () => {
      authStore.blockInfo = ACCOUNT
      route.path = '/blocked'

      useBlockedState().resumeAfterBlock()

      expect(authStore.blockInfo).toBeNull()
      expect(mockInit).toHaveBeenCalledOnce()
      expect(mockConnect).toHaveBeenCalledOnce()
      expect(mockNavigateTo).toHaveBeenCalledWith('/', { replace: true })
    })

    it('socket already connected → not reconnected', () => {
      authStore.blockInfo = ACCOUNT
      socket.isConnected.value = true
      useBlockedState().resumeAfterBlock()
      expect(mockConnect).not.toHaveBeenCalled()
    })
  })

  it('signOut → the normal logout (which clears the block)', async () => {
    await useBlockedState().signOut()
    expect(mockLogout).toHaveBeenCalledOnce()
  })

  it('backToLogin → forgets the block and goes to /log-in', async () => {
    authStore.token = null
    authStore.blockInfo = { kind: 'ip', reason: null, until: null }

    await useBlockedState().backToLogin()

    expect(authStore.blockInfo).toBeNull()
    expect(mockNavigateTo).toHaveBeenCalledWith('/log-in', { replace: true })
  })
})
