// ========================================
// Imports & Types
// ========================================
import type {
  CoinRequest,
  CoinRequestApiResponse,
  CoinRequestPaginatedResponse,
  CreateCoinRequestPayload
} from '~/types/coin-request'
import { useApi } from './useApi'

// ========================================
// Composable
// ========================================

/**
 * Composable for managing coin request API operations.
 * Provides methods to create, list, view, and cancel coin requests.
 *
 * @see docs/Backend-Team/new-feature-implementation-complete-guide.md
 */
export function useCoinRequests() {
  // ========================================
  // Composables / Dependencies
  // ========================================
  const { api, normalizeError } = useApi()

  // ========================================
  // API Methods
  // ========================================

  /**
   * Fetch the authenticated user's coin requests with pagination.
   * @param page - Page number (default: 1)
   * @param perPage - Items per page (default: 15)
   * @returns Promise resolving to paginated coin requests
   */
  async function fetchMyRequests(
    page = 1,
    perPage = 15
  ): Promise<CoinRequestPaginatedResponse<CoinRequest>> {
    return await api<CoinRequestPaginatedResponse<CoinRequest>>(
      `/coin-requests?page=${page}&per_page=${perPage}`
    )
  }

  /**
   * Create a new coin request.
   * Backend automatically uses the user's default reseller.
   *
   * @param payload - Request data (amount, message, proofs)
   * @returns Promise resolving to the created coin request
   */
  async function createRequest(
    payload: CreateCoinRequestPayload
  ): Promise<CoinRequestApiResponse<CoinRequest>> {
    const formData = new FormData()
    formData.append('amount', String(payload.amount))

    if (payload.message?.trim()) {
      formData.append('message', payload.message.trim())
    }

    if (payload.proofs?.length) {
      payload.proofs.forEach((file, index) => {
        formData.append(`proofs[${index}]`, file)
      })
    }

    // reseller_id is intentionally not sent - backend uses user's default

    return await api<CoinRequestApiResponse<CoinRequest>>('/coin-requests', {
      method: 'POST',
      body: formData
    })
  }

  /**
   * Fetch a single coin request by ID.
   * @param id - Coin request ID
   * @returns Promise resolving to the coin request
   */
  async function fetchRequest(
    id: number
  ): Promise<CoinRequestApiResponse<CoinRequest>> {
    return await api<CoinRequestApiResponse<CoinRequest>>(`/coin-requests/${id}`)
  }

  /**
   * Cancel a pending coin request.
   * Only works on requests with 'pending' status.
   *
   * @param id - Coin request ID to cancel
   * @returns Promise resolving to the cancelled coin request
   */
  async function cancelRequest(
    id: number
  ): Promise<CoinRequestApiResponse<CoinRequest>> {
    return await api<CoinRequestApiResponse<CoinRequest>>(`/coin-requests/${id}`, {
      method: 'DELETE'
    })
  }

  // ========================================
  // Return
  // ========================================
  return {
    fetchMyRequests,
    createRequest,
    fetchRequest,
    cancelRequest,
    normalizeError
  }
}
