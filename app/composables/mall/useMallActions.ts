/**
 * Mall Actions Composable
 *
 * Action / Orchestrator composable for purchase, equip, and unequip operations.
 * Each method follows the GATE → EXECUTE → REACT pipeline.
 *
 * This composable owns:
 * - API calls for mutations
 * - Toast notifications (REACT)
 * - Cross-store writes (prop_id sync via userStore for column-based props)
 * - Socket emissions (profile sync for column-based props)
 * - Optimistic updates with rollback
 */
import { createLogger } from '~/utils/logger'
import type {
  PropPurchaseResponse,
  PropEquipResponse,
  PropType,
} from '~/types/mall/prop'
import type { ProfileSyncFields } from '~/types/user/profile-sync'
import { useAuthStore } from '~/stores/auth'

const log = createLogger('[MallActions]')

/** Map PropType → user profile field key (e.g., 'frame' → 'frame_id'). */
const PROP_TYPE_TO_COLUMN: Partial<Record<PropType, keyof ProfileSyncFields>> = {
  frame: 'frame_id',
  chat_bubble: 'chat_bubble_id',
  entry_animation: 'entry_animation_id',
  data_card: 'data_card_id',
  mice_wave: 'mice_wave_id',
  slides: 'slides_id',
}

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
   * REACT:   toast, column-prop sync socket emission
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

    // Cross-store column sync (optimistic) — write prop_id to user profile
    const columnKey = PROP_TYPE_TO_COLUMN[prop.type]
    const previousValue = columnKey ? (authStore.user?.[columnKey] ?? null) : null
    if (columnKey) {
      userStore.patchProfile({ [columnKey]: prop.prop_id })
    }

    try {
      await api<PropEquipResponse>(`/props/${userPropId}/equip`, { method: 'POST' })

      // REACT — success
      toast.add({
        title: 'Prop Equipped',
        color: 'success',
      })

      // Push column prop change to room participants via socket
      if (columnKey) {
        emitColumnSync(columnKey, prop.prop_id)
      }

      return true
    } catch (err) {
      // EXECUTE — rollback first (must complete before REACT feedback)
      mallStore.setUserPropEquipped(userPropId, false)
      mallStore.setEquippedForType(prop.type, previousEquipped)

      if (previousEquipped) {
        mallStore.setUserPropEquipped(previousEquipped.id, true)
      }

      if (columnKey) {
        userStore.patchProfile({ [columnKey]: previousValue })
      }

      // REACT — error feedback (after rollback is complete)
      const normalized = normalizeError(err)
      toast.add({
        title: 'Equip Failed',
        description: normalized.message,
        color: 'error',
      })

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
   * REACT:   toast, column-prop sync socket emission
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

    // Cross-store column sync (optimistic)
    const columnKey = PROP_TYPE_TO_COLUMN[prop.type]
    const previousValue = columnKey ? (authStore.user?.[columnKey] ?? null) : null
    if (columnKey) {
      userStore.patchProfile({ [columnKey]: null })
    }

    try {
      await api(`/props/${userPropId}/unequip`, { method: 'POST' })

      // REACT — success
      toast.add({
        title: 'Prop Unequipped',
        color: 'neutral',
      })

      // Push column prop removal to room participants via socket
      if (columnKey) {
        emitColumnSync(columnKey, null)
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

      if (columnKey) {
        userStore.patchProfile({ [columnKey]: previousValue })
      }

      // REACT — error feedback (after rollback is complete)
      const normalized = normalizeError(err)
      toast.add({
        title: 'Unequip Failed',
        description: normalized.message,
        color: 'error',
      })

      return false
    } finally {
      isEquipping.value = null
    }
  }

  // ========================================
  // Helpers (private)
  // ========================================

  /**
   * Push column-prop change through the audio socket for immediate room propagation.
   * Best-effort / fire-and-forget (REACT).
   */
  function emitColumnSync(columnKey: keyof ProfileSyncFields, value: number | null): void {
    try {
      emitProfileSync({ [columnKey]: value })
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

