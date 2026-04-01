/**
 * Mall Actions Composable
 *
 * Action / Orchestrator composable for purchase, equip, and unequip operations.
 * Each method follows the GATE → EXECUTE → REACT pipeline.
 *
 * This composable owns:
 * - API calls for mutations
 * - Toast notifications (REACT)
 * - Cross-store writes (frame sync via userStore)
 * - Socket emissions (profile sync for frames)
 * - Optimistic updates with rollback
 */
import { createLogger } from '~/utils/logger'
import type {
  PropPurchaseResponse,
  PropEquipResponse,
} from '~/types/mall/prop'
import { useAuthStore } from '~/stores/auth'

const log = createLogger('[MallActions]')

// ========================================
// Module-level state — shared across all useMallActions() callers
// ========================================
// These are concurrency guards. They MUST be module-level so that
// two components calling useMallActions() share the same guard,
// preventing duplicate requests globally.

const isPurchasing = ref(false)
const isEquipping = ref<number | null>(null)

export function useMallActions() {
  // ========================================
  // Dependencies
  // ========================================

  const { api, normalizeError } = useApi()
  const toast = useToast()
  const mallStore = useMallStore()
  const authStore = useAuthStore()
  const userStore = useUserStore()
  const { emitProfileSync } = useProfileActions()

  // ========================================
  // Purchase
  // ========================================

  /**
   * Purchase a prop.
   *
   * GATE:    check isPurchasing guard
   * EXECUTE: POST API → refresh user props
   * REACT:   clear selection, toast success/error
   */
  async function purchaseProp(propId: number): Promise<boolean> {
    // GATE
    if (isPurchasing.value) return false

    // EXECUTE
    isPurchasing.value = true

    try {
      const response = await api<PropPurchaseResponse>(`/props/${propId}/purchase`, {
        method: 'POST',
      })

      // Refresh user props to show new purchase
      const { fetchUserProps } = useMallUserProps()
      await fetchUserProps({}, true)

      // REACT — success
      mallStore.selectProp(null)
      toast.add({
        title: 'Purchase Successful',
        description: `New balance: ${response.data.balance.coins_after.toLocaleString()} coins`,
        color: 'success',
      })

      return true
    } catch (err) {
      // REACT — error feedback
      const normalized = normalizeError(err)

      if (normalized.status === 402) {
        toast.add({
          title: 'Insufficient Balance',
          description: 'You don\'t have enough coins for this purchase.',
          color: 'error',
        })
      } else if (normalized.status === 400) {
        toast.add({
          title: 'Purchase Failed',
          description: normalized.message || 'This prop is not available.',
          color: 'error',
        })
      } else {
        toast.add({
          title: 'Purchase Failed',
          description: normalized.message,
          color: 'error',
        })
      }

      log.error('purchaseProp failed:', err)
      return false
    } finally {
      isPurchasing.value = false
    }
  }

  // ========================================
  // Equip
  // ========================================

  /**
   * Equip a user prop.
   *
   * GATE:    check isEquipping guard, find prop
   * EXECUTE: optimistic update → API POST → confirm or rollback
   * REACT:   toast, frame sync socket emission
   */
  async function equipProp(userPropId: number): Promise<boolean> {
    // GATE
    if (isEquipping.value !== null) return false

    const prop = mallStore.userProps.items.find(p => p.id === userPropId)
    if (!prop) return false

    // EXECUTE — optimistic update
    isEquipping.value = userPropId

    const previousEquipped = mallStore.equipped[prop.type]
    mallStore.setUserPropEquipped(userPropId, true)

    // Auto-unequip previous of same type
    if (previousEquipped) {
      mallStore.setUserPropEquipped(previousEquipped.id, false)
    }

    // Update equipped map optimistically
    mallStore.setEquippedForType(prop.type, {
      id: prop.id,
      prop_id: prop.prop_id,
      name: prop.name,
      asset_url: prop.asset_url,
    })

    // Cross-store frame sync (optimistic)
    const previousFrame = prop.type === 'frame' ? (authStore.user?.frame ?? null) : null
    if (prop.type === 'frame') {
      userStore.patchProfile({ frame: prop.asset_url })
    }

    try {
      await api<PropEquipResponse>(`/props/${userPropId}/equip`, { method: 'POST' })

      // REACT — success
      toast.add({
        title: 'Prop Equipped',
        color: 'success',
      })

      // Push frame change to room participants via socket
      if (prop.type === 'frame') {
        emitFrameSync(prop.asset_url)
      }

      return true
    } catch (err) {
      // EXECUTE — rollback first (must complete before REACT feedback)
      mallStore.setUserPropEquipped(userPropId, false)
      mallStore.setEquippedForType(prop.type, previousEquipped)

      if (previousEquipped) {
        mallStore.setUserPropEquipped(previousEquipped.id, true)
      }

      if (prop.type === 'frame') {
        userStore.patchProfile({ frame: previousFrame })
      }

      // REACT — error feedback (after rollback is complete)
      const normalized = normalizeError(err)
      toast.add({
        title: 'Equip Failed',
        description: normalized.message,
        color: 'error',
      })

      log.error('equipProp failed:', err)
      return false
    } finally {
      isEquipping.value = null
    }
  }

  // ========================================
  // Unequip
  // ========================================

  /**
   * Unequip a user prop.
   *
   * GATE:    check isEquipping guard, find prop
   * EXECUTE: optimistic update → API POST → confirm or rollback
   * REACT:   toast, frame sync socket emission
   */
  async function unequipProp(userPropId: number): Promise<boolean> {
    // GATE
    if (isEquipping.value !== null) return false

    const prop = mallStore.userProps.items.find(p => p.id === userPropId)
    if (!prop) return false

    // EXECUTE — optimistic update
    isEquipping.value = userPropId

    const previousState = prop.is_equipped
    mallStore.setUserPropEquipped(userPropId, false)
    mallStore.setEquippedForType(prop.type, null)

    // Cross-store frame sync (optimistic)
    const previousFrame = prop.type === 'frame' ? (authStore.user?.frame ?? null) : null
    if (prop.type === 'frame') {
      userStore.patchProfile({ frame: null })
    }

    try {
      await api(`/props/${userPropId}/unequip`, { method: 'POST' })

      // REACT — success
      toast.add({
        title: 'Prop Unequipped',
        color: 'neutral',
      })

      // Push frame removal to room participants via socket
      if (prop.type === 'frame') {
        emitFrameSync(null)
      }

      return true
    } catch (err) {
      // EXECUTE — rollback first (must complete before REACT feedback)
      mallStore.setUserPropEquipped(userPropId, previousState)
      if (previousState) {
        mallStore.setEquippedForType(prop.type, {
          id: prop.id,
          prop_id: prop.prop_id,
          name: prop.name,
          asset_url: prop.asset_url,
        })
      }

      if (prop.type === 'frame') {
        userStore.patchProfile({ frame: previousFrame })
      }

      // REACT — error feedback (after rollback is complete)
      const normalized = normalizeError(err)
      toast.add({
        title: 'Unequip Failed',
        description: normalized.message,
        color: 'error',
      })

      log.error('unequipProp failed:', err)
      return false
    } finally {
      isEquipping.value = null
    }
  }

  // ========================================
  // Helpers (private)
  // ========================================

  /**
   * Push frame change through the audio socket for immediate room propagation.
   * Best-effort / fire-and-forget (REACT).
   */
  function emitFrameSync(frame: string | null): void {
    try {
      emitProfileSync({ frame })
    } catch {
      // Silent — best-effort optimization
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    isPurchasing: readonly(isPurchasing),
    isEquipping: readonly(isEquipping),

    // Methods
    purchaseProp,
    equipProp,
    unequipProp,
  }
}

