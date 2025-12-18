// ========================================
// Imports & Types
// ========================================
import type { ApiResponse, ResellerApiRow, UpdateDefaultResellerRequest } from '~/types/reseller'
import { useApi } from './useApi'

// ========================================
// Composable
// ========================================

/**
 * Composable for managing reseller-related API operations.
 * Provides methods to fetch resellers, get/update user's default reseller.
 *
 * @see docs/Backend-Team/chose-or-update-default-coin-reseller-feature.md
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
   * Fetch all available resellers with optional signature filter.
   * @param signature - Optional partial match filter for signature field
   * @returns Promise resolving to array of resellers
   */
  async function fetchResellers(signature?: string): Promise<ApiResponse<ResellerApiRow[]>> {
    // Only include params if signature is provided (ofetch handles undefined gracefully)
    const options = signature ? { params: { signature } } : {}
    return await api<ApiResponse<ResellerApiRow[]>>('/resellers', options)
  }

  /**
   * Get the current user's default reseller.
   * Returns null in data field if no default is set.
   * @returns Promise resolving to current default reseller or null
   */
  async function getDefaultReseller(): Promise<ApiResponse<ResellerApiRow | null>> {
    return await api<ApiResponse<ResellerApiRow | null>>('/user/default-reseller')
  }

  /**
   * Update the current user's default reseller.
   * @param resellerId - ID of the reseller to set as default
   * @returns Promise resolving to the newly set default reseller
   */
  async function updateDefaultReseller(resellerId: number): Promise<ApiResponse<ResellerApiRow>> {
    const body: UpdateDefaultResellerRequest = { reseller_id: resellerId }
    return await api<ApiResponse<ResellerApiRow>>('/user/default-reseller', {
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
