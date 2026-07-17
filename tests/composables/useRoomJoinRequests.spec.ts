// ========================================
// useRoomJoinRequests Composable Tests
// ========================================
// Covers issue 05-chat-bubbles-approve-idempotency.md (Part B): approve/reject
// must GATE on an in-flight request id so a fast double-tap can't double-fire
// the API call, and must re-enable (clear the in-flight flag) after failure
// so a re-tap after an error is safe.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

let apiMock = vi.fn()

beforeEach(async () => {
  vi.resetModules()
  setActivePinia(createPinia())
  apiMock = vi.fn().mockResolvedValue({})
  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  })
  ;(globalThis as Record<string, unknown>).useToast = () => ({ add: vi.fn() })

  const { useRoomMembershipStore } = await import('~/stores/roomMembership')
  const membershipStore = useRoomMembershipStore()
  ;(globalThis as Record<string, unknown>).useRoomMembershipStore = () => membershipStore
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useApi')
  Reflect.deleteProperty(globalThis, 'useToast')
  Reflect.deleteProperty(globalThis, 'useRoomMembershipStore')
})

describe('useRoomJoinRequests — approve/reject in-flight guard', () => {
  it('ignores a second approve call while the first is still in flight', async () => {
    let resolveApi: (v: unknown) => void = () => {}
    apiMock.mockReturnValue(new Promise((resolve) => { resolveApi = resolve }))

    const { useRoomJoinRequests } = await import('~/composables/room/useRoomJoinRequests')
    const { approveJoinRequest, isRequestActionPending } = useRoomJoinRequests()

    const firstCall = approveJoinRequest(1)
    expect(isRequestActionPending(1)).toBe(true)

    const secondCall = approveJoinRequest(1)
    resolveApi({})
    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall])

    expect(apiMock).toHaveBeenCalledOnce()
    expect(firstResult).toBe(true)
    expect(secondResult).toBe(false)
    expect(isRequestActionPending(1)).toBe(false)
  })

  it('re-enables the request after a failed approve so a re-tap can succeed', async () => {
    apiMock.mockRejectedValueOnce(new Error('network error'))

    const { useRoomJoinRequests } = await import('~/composables/room/useRoomJoinRequests')
    const { approveJoinRequest, isRequestActionPending } = useRoomJoinRequests()

    const result = await approveJoinRequest(2)

    expect(result).toBe(false)
    expect(isRequestActionPending(2)).toBe(false)

    apiMock.mockResolvedValueOnce({})
    const retryResult = await approveJoinRequest(2)
    expect(retryResult).toBe(true)
  })

  it('tracks reject in-flight state independently per request id', async () => {
    let resolveApi: (v: unknown) => void = () => {}
    apiMock.mockReturnValue(new Promise((resolve) => { resolveApi = resolve }))

    const { useRoomJoinRequests } = await import('~/composables/room/useRoomJoinRequests')
    const { rejectJoinRequest, isRequestActionPending } = useRoomJoinRequests()

    const pending = rejectJoinRequest(3)
    expect(isRequestActionPending(3)).toBe(true)
    expect(isRequestActionPending(4)).toBe(false)

    resolveApi({})
    await pending
    expect(isRequestActionPending(3)).toBe(false)
  })
})
