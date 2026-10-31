// ========================================
// useAuthLifecycle Tests (account-bans 04)
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useAuthLifecycle } from '~/composables/auth/useAuthLifecycle'

const mockEnterBlocked = vi.fn()
const mockLogout = vi.fn()
const mockDisconnect = vi.fn()
const mockSetBlockInfo = vi.fn()
const mockLeaveRoom = vi.fn()

vi.stubGlobal('useBlockedState', () => ({ enterBlocked: mockEnterBlocked }))
vi.stubGlobal('useAuthActions', () => ({ logout: mockLogout }))
vi.stubGlobal('useAudioSocket', () => ({ disconnect: mockDisconnect }))
vi.stubGlobal('useAuthStore', () => ({ setBlockInfo: mockSetBlockInfo }))
vi.stubGlobal('useRoomSession', () => ({ leaveRoom: mockLeaveRoom }))

describe('useAuthLifecycle.handleForceDisconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("'blocked' → enterBlocked with the exact account block; no logout", async () => {
    await useAuthLifecycle().handleForceDisconnect({
      reason: 'blocked',
      blocked_reason: 'Spam',
      blocked_until: '2026-11-02T10:00:00Z',
    })

    expect(mockEnterBlocked).toHaveBeenCalledOnce()
    expect(mockEnterBlocked).toHaveBeenCalledWith({
      kind: 'account',
      reason: 'Spam',
      until: '2026-11-02T10:00:00Z',
    })
    expect(mockLogout).not.toHaveBeenCalled()
    expect(mockDisconnect).not.toHaveBeenCalled()
    expect(mockLeaveRoom).not.toHaveBeenCalled()
  })

  it("'blocked' with missing blocked_* fields → nulls", async () => {
    await useAuthLifecycle().handleForceDisconnect({ reason: 'blocked' })

    expect(mockEnterBlocked).toHaveBeenCalledWith({ kind: 'account', reason: null, until: null })
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it("'signed_out' → leaves the room and drops the socket BEFORE logout; never stores a block, even with blocked_* present", async () => {
    await useAuthLifecycle().handleForceDisconnect({
      reason: 'signed_out',
      blocked_reason: 'Spam',
      blocked_until: '2026-11-02T10:00:00Z',
    })

    expect(mockLeaveRoom).toHaveBeenCalledOnce()
    expect(mockDisconnect).toHaveBeenCalledOnce()
    expect(mockLogout).toHaveBeenCalledOnce()
    // Room left and socket dropped before logout's network round-trip.
    expect(mockLeaveRoom.mock.invocationCallOrder[0]).toBeLessThan(mockLogout.mock.invocationCallOrder[0]!)
    expect(mockDisconnect.mock.invocationCallOrder[0]).toBeLessThan(mockLogout.mock.invocationCallOrder[0]!)
    expect(mockEnterBlocked).not.toHaveBeenCalled()
    expect(mockSetBlockInfo).not.toHaveBeenCalled()
  })

  it('unknown reason → same plain session end as signed_out', async () => {
    await useAuthLifecycle().handleForceDisconnect({ reason: 'something_new' })

    expect(mockDisconnect.mock.invocationCallOrder[0]).toBeLessThan(mockLogout.mock.invocationCallOrder[0]!)
    expect(mockLogout).toHaveBeenCalledOnce()
    expect(mockEnterBlocked).not.toHaveBeenCalled()
    expect(mockSetBlockInfo).not.toHaveBeenCalled()
  })
})
