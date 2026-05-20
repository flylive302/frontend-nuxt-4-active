// ========================================
// Imports & Types
// ========================================
import type {
  VipLevel,
  VipStatus,
  VipApiResponse,
  VipPurchaseResult,
  RechargeProgress,
} from '~/types/vip/vip-level'
import { useApi } from '../shared/useApi'

// ========================================
// Composable
// ========================================

/**
 * Composable for VIP system API operations and status management.
 * Provides methods to fetch levels, check status, purchase, and gift VIP.
 */
export function useVip() {
  // ========================================
  // Composables / Dependencies
  // ========================================
  const { api, normalizeError } = useApi()
  const authStore = useAuthStore()

  // ========================================
  // Computed
  // ========================================

  /**
   * Current user's VIP level number (0 = no VIP).
   */
  const currentLevel = computed(() => authStore.user?.vip_level ?? 0)

  /**
   * Whether the current user has any active VIP.
   */
  const isVip = computed(() => currentLevel.value > 0)

  /**
   * Current user's VIP expiry date.
   */
  const expiresAt = computed(() => authStore.user?.vip_expires_at ?? null)

  // ========================================
  // API Methods
  // ========================================

  /**
   * Fetch all available VIP levels with pricing and privileges.
   * @returns Promise resolving to array of VIP levels
   */
  async function fetchLevels(): Promise<VipLevel[]> {
    const response = await api<VipApiResponse<VipLevel[]>>('/vip/levels')
    return response.data
  }

  /**
   * Fetch the current user's VIP status.
   * @returns Promise resolving to VIP status
   */
  async function fetchStatus(): Promise<VipStatus> {
    const response = await api<VipApiResponse<VipStatus>>('/vip/status')
    return response.data
  }

  /**
   * Purchase VIP for the current user.
   * @param vipLevelId - ID of the VIP level to purchase
   * @returns Promise resolving to purchase result
   */
  async function purchaseVip(vipLevelId: number): Promise<VipPurchaseResult> {
    // F-54: a UUID per click makes the call idempotent on the backend. A
    // fast-double-click or HTTP retry sends the same key and gets the same
    // success response without a second deduction or VIP extension.
    const response = await api<VipApiResponse<VipPurchaseResult>>(`/vip/${vipLevelId}/purchase`, {
      method: 'POST',
      body: { idempotency_key: crypto.randomUUID() },
    })
    return response.data
  }

  /**
   * Gift VIP to another user (must be a follower or following).
   * @param vipLevelId - ID of the VIP level to gift
   * @param recipientId - ID of the recipient user
   * @returns Promise resolving to purchase result
   */
  async function giftVip(
    vipLevelId: number,
    recipientId: number,
  ): Promise<VipPurchaseResult> {
    const response = await api<VipApiResponse<VipPurchaseResult>>('/vip/gift', {
      method: 'POST',
      body: {
        vip_level_id: vipLevelId,
        recipient_id: recipientId,
        idempotency_key: crypto.randomUUID(),
      },
    })
    return response.data
  }

  /**
   * Fetch recharge progress for the current user.
   * @returns Promise resolving to recharge progress data
   */
  async function fetchRechargeProgress(): Promise<RechargeProgress> {
    const response = await api<VipApiResponse<RechargeProgress>>('/vip/recharge-progress')
    return response.data
  }

  // ========================================
  // Return
  // ========================================
  return {
    // Computed
    currentLevel,
    isVip,
    expiresAt,
    // API Methods
    fetchLevels,
    fetchStatus,
    purchaseVip,
    giftVip,
    fetchRechargeProgress,
    normalizeError,
  }
}
