// ========================================
// Imports & Types
// ========================================
import type { ApiResponse, ResellerApiRow, UpdateDefaultResellerRequest } from '~/types/economy/reseller'
import { useApi } from '../shared/useApi'

// ========================================
// Composable
// ========================================

/**
 * Composable for managing reviewer-related API operations.
 * Provides methods to fetch reviewers, get/update user's default reviewer.
 */
export function useResellers() {
  // ========================================
  // Composables / Dependencies
  // ========================================
  const { api, normalizeError } = useApi()

  // ========================================
  // API Methods
  // ========================================

  /**
   * Fetch all available reviewers with optional signature filter.
   * @param signature - Optional partial match filter for signature field
   * @returns Promise resolving to array of reviewers
   */
  async function fetchResellers(signature?: string): Promise<ApiResponse<ResellerApiRow[]>> {
    const options = signature ? { params: { signature } } : {}
    return await api<ApiResponse<ResellerApiRow[]>>('/reviewers', options)
  }

  /**
   * Get the current user's default reviewer.
   * Returns null in data field if no default is set.
   * @returns Promise resolving to current default reviewer or null
   */
  async function getDefaultReseller(): Promise<ApiResponse<ResellerApiRow | null>> {
    return await api<ApiResponse<ResellerApiRow | null>>('/user/default-reviewer')
  }

  /**
   * Update the current user's default reviewer.
   * @param reviewerId - ID of the reviewer to set as default
   * @returns Promise resolving to the newly set default reviewer
   */
  async function updateDefaultReseller(reviewerId: number): Promise<ApiResponse<ResellerApiRow>> {
    const body: UpdateDefaultResellerRequest = { reviewer_id: reviewerId }
    return await api<ApiResponse<ResellerApiRow>>('/user/default-reviewer', {
      method: 'PUT',
      body
    })
  }

  // ========================================
  // Return
  // ========================================
  return {
    fetchResellers,
    getDefaultReseller,
    updateDefaultReseller,
    normalizeError
  }
}
