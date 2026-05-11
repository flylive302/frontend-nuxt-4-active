// ========================================
// Imports & Types
// ========================================
import type {
  CoinRequest,
  CoinRequestApiResponse,
  CoinRequestPaginatedResponse,
  CreateCoinRequestPayload
} from '~/types/economy/coin-request'
import { useApi } from '../shared/useApi'

// ========================================
// Composable
// ========================================

/**
 * Composable for managing coin request API operations.
 * Provides methods to create, list, view, and cancel coin requests.
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
   * Create a new coin grant request.
   * Backend automatically uses the user's default reviewer.
   *
   * @param payload - Request data (amount, optional message)
   * @returns Promise resolving to the created coin request
   */
  async function createRequest(
    payload: CreateCoinRequestPayload
  ): Promise<CoinRequestApiResponse<CoinRequest>> {
    return await api<CoinRequestApiResponse<CoinRequest>>('/coin-requests', {
      method: 'POST',
      body: {
        amount: payload.amount,
        message: payload.message?.trim() || undefined,
      },
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
