// ========================================
// Prop Lookup Composable
// ========================================
// Role: O(1) prop resolution from mallStore.propIndex.
// Includes failsafe: if prop_id is not in the index,
// fetches it lazily from the API and merges it in.
// ========================================

import type { BootstrapProp } from '~/types/user/bootstrap'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PropLookup]')

/** Track in-flight failsafe fetches to avoid duplicate requests. */
const pendingFetches = new Set<number>()

/**
 * Composable for resolving prop data from the mallStore prop index.
 *
 * Usage:
 *   const { resolveProp, resolvePropAsset, resolvePropThumbnail } = usePropLookup()
 *   const assetUrl = resolvePropAsset(user.frame_id)
 */
export function usePropLookup() {
  const mallStore = useMallStore()
  const { api } = useApi()

  /**
   * Resolve a prop by ID from the local index.
   * Returns the full BootstrapProp or null if not found (yet).
   * Triggers a background failsafe fetch on cache-miss.
   */
  function resolveProp(propId: number | null | undefined): BootstrapProp | null {
    if (propId == null) return null

    const cached = mallStore.propIndex[propId]
    if (cached) return cached

    // Failsafe: prop_id exists but isn't in our index — fetch it lazily
    triggerFailsafeFetch(propId)
    return null
  }

  /**
   * Resolve a prop's asset_url by ID.
   * Returns null if prop is not yet in the index.
   */
  function resolvePropAsset(propId: number | null | undefined): string | null {
    return resolveProp(propId)?.asset_url ?? null
  }

  /**
   * Resolve a prop's thumbnail_url by ID.
   * Returns null if prop is not yet in the index.
   */
  function resolvePropThumbnail(propId: number | null | undefined): string | null {
    return resolveProp(propId)?.thumbnail_url ?? null
  }

  /**
   * Resolve a prop's name by ID.
   */
  function resolvePropName(propId: number | null | undefined): string | null {
    return resolveProp(propId)?.name ?? null
  }

  /**
   * Resolve a prop by ID, awaiting a background fetch on cache-miss.
   * Use in async contexts where the animation must not be silently skipped.
   */
  async function resolvePropAsync(propId: number | null | undefined): Promise<BootstrapProp | null> {
    if (propId == null) return null
    const cached = mallStore.propIndex[propId]
    if (cached) return cached
    await triggerFailsafeFetch(propId)
    return mallStore.propIndex[propId] ?? null
  }

  /**
   * Background fetch for a cache-miss prop.
   * Deduplicates concurrent requests for the same ID.
   * On success, merges the prop into mallStore.propIndex — reactive consumers re-render.
   */
  async function triggerFailsafeFetch(propId: number): Promise<void> {
    if (pendingFetches.has(propId)) return
    pendingFetches.add(propId)

    try {
      const response = await api<{ data: { prop: BootstrapProp } }>(`/props/${propId}`)
      if (response?.data?.prop) {
        mallStore.addToPropIndex(response.data.prop)
      }
    } catch (e) {
      log.warn('Failed to fetch prop from API', e)
    } finally {
      pendingFetches.delete(propId)
    }
  }

  return {
    resolveProp,
    resolvePropAsync,
    resolvePropAsset,
    resolvePropThumbnail,
    resolvePropName,
  }
}
