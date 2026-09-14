// ========================================
// Agency Store Tests
// ========================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type { AgencyJoinRequest } from '../../app/types/agency/agency'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

// ========================================
// Fixtures
// ========================================

function makeJoinRequest(id: number, status: AgencyJoinRequest['status']): AgencyJoinRequest {
  return {
    id,
    status,
    status_label: status,
    message: null,
    created_at: '2024-01-01T00:00:00Z',
    can_be_processed: status === 'pending',
  } as AgencyJoinRequest
}

// ========================================
// pendingJoinRequestCount
// ========================================

describe('useAgencyStore.pendingJoinRequestCount', () => {
  it('counts only requests with status pending', async () => {
    const { useAgencyStore } = await import('../../app/stores/agency')
    const store = useAgencyStore()

    store.myJoinRequests.items = [
      makeJoinRequest(1, 'pending'),
      makeJoinRequest(2, 'approved'),
      makeJoinRequest(3, 'pending'),
      makeJoinRequest(4, 'rejected'),
      makeJoinRequest(5, 'cancelled'),
    ]

    expect(store.pendingJoinRequestCount).toBe(2)
  })

  it('is 0 when there are no join requests', async () => {
    const { useAgencyStore } = await import('../../app/stores/agency')
    const store = useAgencyStore()

    expect(store.pendingJoinRequestCount).toBe(0)
  })
})

// ========================================
// $reset
// ========================================

describe('useAgencyStore.$reset', () => {
  it('clears userAgency, receivedInvitations, and myJoinRequests back to their initial shape', async () => {
    const { useAgencyStore } = await import('../../app/stores/agency')
    const store = useAgencyStore()

    store.userAgency.agency = { id: 1, name: 'Agency', country: 'US', logo: null, status: 'approved', status_label: 'Active', created_at: '2024-01-01T00:00:00Z' }
    store.userAgency.isOwner = true
    store.userAgency.loading = true

    store.receivedInvitations.items = [{ id: 1 } as never]
    store.receivedInvitations.hasMore = false
    store.receivedInvitations.cursor = 'cursor-1'
    store.receivedInvitations.loading = true

    store.myJoinRequests.items = [makeJoinRequest(1, 'pending')]
    store.myJoinRequests.hasMore = false
    store.myJoinRequests.cursor = 'cursor-2'
    store.myJoinRequests.loading = true

    store.$reset()

    expect(store.userAgency.agency).toBeNull()
    expect(store.userAgency.isOwner).toBe(false)
    expect(store.userAgency.loading).toBe(false)

    expect(store.receivedInvitations).toEqual({
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    })

    expect(store.myJoinRequests).toEqual({
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    })

    expect(store.pendingJoinRequestCount).toBe(0)
  })
})
