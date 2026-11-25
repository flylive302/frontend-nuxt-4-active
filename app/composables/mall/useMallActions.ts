/**
 * Mall Actions Composable
 *
 * Action / Orchestrator composable for purchase, equip, and unequip operations.
 * Each method follows the GATE → EXECUTE → REACT pipeline.
 *
 * This composable owns:
 * - API calls for mutations
 * - Toast notifications (REACT)
 * - Cross-store writes (prop_id sync via authStore for column-based props;
 *   the Signature number from the equip/unequip response for signature props)
 * - Socket emissions (profile sync for column-based props)
 * - Optimistic updates with rollback
 */
import type {
  PropPurchaseResponse,
  PropEquipResponse,
  PropUnequipResponse,
  PropType,
  UserProp,
} from '~/types/mall/prop'
import type { ProfileSyncFields } from '~/types/user/profile-sync'
import type { NormalizedError } from '~/utils/api/normalizeFetchError'
import { useAuthStore } from '~/stores/auth'
import {
  ORIGINAL_SIGNATURE_LOCKED_CODE,
  ORIGINAL_SIGNATURE_LOCKED_MESSAGE,
  isOriginalSignature,
} from '~/utils/userPropOrigin'


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
  const { emitProfileSync } = useProfileActions()
  const { syncUser } = useUserSync()

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
      authStore.patchProfile({ [columnKey]: prop.prop_id })
    }

    try {
      const response = await api<PropEquipResponse>(`/props/${userPropId}/equip`, { method: 'POST' })

      // REACT — success
      toast.add({
        title: 'Prop Equipped',
        color: 'success',
      })

      // Signature is not a column prop: the server answers with the number it
      // set. The first equip also creates the user's original-signature row,
      // so the list is re-read (refreshSignatureState).
      if (prop.type === 'signature') {
        await refreshSignatureState(response?.data?.signature ?? null, null, prop)
      }

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
        authStore.patchProfile({ [columnKey]: previousValue })
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
   * GATE:    check isEquipping guard, find prop, refuse the original signature
   * EXECUTE: optimistic update → API POST → confirm or rollback
   *          (a signature is NOT optimistic: the server switches the user to
   *          their original signature, so the response says what is equipped)
   * REACT:   toast, column-prop sync socket emission
   */
  async function unequipProp(userPropId: number): Promise<boolean> {
    // GATE
    if (isEquipping.value !== null) return false

    const prop = mallStore.userProps.items.find(p => p.id === userPropId)
    if (!prop) return false

    if (isOriginalSignature(prop)) {
      toast.add({
        title: 'Unequip Failed',
        description: ORIGINAL_SIGNATURE_LOCKED_MESSAGE,
        color: 'error',
      })
      return false
    }

    // EXECUTE
    isEquipping.value = userPropId

    const isSignature = prop.type === 'signature'
    const previousState = prop.is_equipped

    // Optimistic update — column props only
    const columnKey = PROP_TYPE_TO_COLUMN[prop.type]
    const previousValue = columnKey ? (authStore.user?.[columnKey] ?? null) : null
    if (!isSignature) {
      mallStore.setUserPropEquipped(userPropId, false)
      mallStore.setEquippedForType(prop.type, null)

      if (columnKey) {
        authStore.patchProfile({ [columnKey]: null })
      }
    }

    try {
      const response = await api<PropUnequipResponse>(`/props/${userPropId}/unequip`, { method: 'POST' })

      // Signature: this row steps down, the one the server names steps up.
      const nowEquippedId = response?.data?.equipped_prop_id ?? null
      if (isSignature) {
        mallStore.setUserPropEquipped(userPropId, false)
        if (nowEquippedId !== null) {
          mallStore.setUserPropEquipped(nowEquippedId, true)
        }
      }

      // REACT — success
      toast.add({
        title: 'Prop Unequipped',
        color: 'neutral',
      })

      if (isSignature) {
        await refreshSignatureState(response?.data?.signature ?? null, nowEquippedId)
      }

      // Push column prop removal to room participants via socket
      if (columnKey) {
        emitColumnSync(columnKey, null)
      }

      return true
    } catch (err) {
      // EXECUTE — rollback first (must complete before REACT feedback)
      if (!isSignature) {
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
          authStore.patchProfile({ [columnKey]: previousValue })
        }
      }

      // REACT — error feedback (after rollback is complete)
      const normalized = normalizeError(err)
      toast.add({
        title: 'Unequip Failed',
        description: errorCodeOf(normalized) === ORIGINAL_SIGNATURE_LOCKED_CODE
          ? ORIGINAL_SIGNATURE_LOCKED_MESSAGE
          : normalized.message,
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
   * After a signature equip/unequip: show the number the server set on the
   * signed-in user (profile updates without a reload), tell the room, and
   * re-read My Props so exactly one signature shows equipped. `equippedUserPropId`
   * (unequip only) is the row the server switched to — when it is in the list it
   * is also mirrored into the equipped map. Best-effort (REACT).
   *
   * `pretty_id_tier` (drives the profile's gold plate) is not in the equip /
   * unequip response and a user-prop row does not carry it. So it is cleared
   * together with the signature (exact for an original or mall signature — the
   * plate never shows next to the wrong number), and only when the row now worn
   * is a Pretty ID (or unknown) is the signed-in user re-read to learn its tier.
   */
  async function refreshSignatureState(
    signature: string | null,
    equippedUserPropId: number | null = null,
    equippedRow: UserProp | undefined = undefined,
  ): Promise<void> {
    const worn = equippedRow
      ?? (equippedUserPropId !== null
        ? mallStore.userProps.items.find(p => p.id === equippedUserPropId)
        : undefined)

    if (signature !== null) {
      authStore.patchProfile({ signature, pretty_id_tier: null })
      try {
        emitProfileSync({ signature })
      } catch {
        // Silent — best-effort optimization
      }
    }

    if (equippedUserPropId !== null && worn) {
      mallStore.setEquippedForType('signature', {
        id: worn.id,
        prop_id: worn.prop_id,
        name: worn.name,
        asset_url: worn.asset_url,
      })
    }

    // A Pretty ID's tier is only known to the server: re-read the user (best-effort).
    if (signature !== null && (worn === undefined || worn.origin === 'pretty_id')) {
      void syncUser()
    }

    // Authoritative re-read: the first equip creates the original row; an
    // unequip's target may be on a page/filter that is not loaded.
    const { fetchUserProps } = useMallUserProps()
    await fetchUserProps({}, true)
  }

  /** Machine-readable error code of a failed call (`errors.error_code` or `meta.error_code`). */
  function errorCodeOf(error: NormalizedError): string | undefined {
    if (error.errorCode) return error.errorCode
    const metaCode = error.meta?.error_code
    if (typeof metaCode === 'string') return metaCode
    const data = (error.raw as { response?: { _data?: { errors?: { error_code?: unknown } } } } | undefined)
      ?.response?._data
    const bodyCode = data?.errors?.error_code
    return typeof bodyCode === 'string' ? bodyCode : undefined
  }

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

