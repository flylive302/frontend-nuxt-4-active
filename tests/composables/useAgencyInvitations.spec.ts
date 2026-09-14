// ========================================
// useAgencyInvitations Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}))

interface StubInvitation {
  id: number
}

interface ReceivedInvitationsState {
  items: StubInvitation[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

let apiMock = vi.fn()
let store: { receivedInvitations: ReceivedInvitationsState, sentInvitations: ReceivedInvitationsState }

function freshInvitationsState(): ReceivedInvitationsState {
  return { items: [], loading: false, error: null, hasMore: true, cursor: null }
}

/** One page of the wire shape the invitations endpoints return. */
function page(ids: number[], nextCursor: string | null) {
  return {
    data: ids.map(id => ({ id })),
    meta: { next_cursor: nextCursor },
  }
}

beforeEach(() => {
  vi.resetModules()
  apiMock = vi.fn().mockResolvedValue(page([], null))
  store = { receivedInvitations: freshInvitationsState(), sentInvitations: freshInvitationsState() }

  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  })
  ;(globalThis as Record<string, unknown>).useAgencyStore = () => store
  ;(globalThis as Record<string, unknown>).useToast = () => ({ add: vi.fn() })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useApi')
  Reflect.deleteProperty(globalThis, 'useAgencyStore')
  Reflect.deleteProperty(globalThis, 'useToast')
})

async function loadComposable() {
  const { useAgencyInvitations } = await import('~/composables/agency/useAgencyInvitations')
  return useAgencyInvitations()
}

describe('useAgencyInvitations — fetchReceivedInvitations', () => {
  it('does not call the API when hasMore is false and reset is not requested', async () => {
    store.receivedInvitations.hasMore = false
    store.receivedInvitations.items = [{ id: 1 }, { id: 2 }]

    const { fetchReceivedInvitations } = await loadComposable()

    await fetchReceivedInvitations()

    expect(apiMock).not.toHaveBeenCalled()
    expect(store.receivedInvitations.items).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('calls the API and replaces items when reset is true, even if hasMore was false', async () => {
    store.receivedInvitations.hasMore = false
    store.receivedInvitations.items = [{ id: 1 }, { id: 2 }]
    apiMock.mockResolvedValueOnce(page([9, 10], null))

    const { fetchReceivedInvitations } = await loadComposable()

    await fetchReceivedInvitations(true)

    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(store.receivedInvitations.items).toEqual([{ id: 9 }, { id: 10 }])
    expect(store.receivedInvitations.hasMore).toBe(false)
  })
})
