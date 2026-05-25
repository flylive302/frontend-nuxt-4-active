/**
 * Mall User Props Composable
 *
 * Data / Query composable for fetching user-owned props and equipped state.
 * Handles: fetchUserProps, fetchEquipped, setStatus
 *
 * Pipeline: GATE (guards) → EXECUTE (API + store write) → REACT (none — pure data)
 */
import { createLogger } from '~/utils/logger'
import type {
  GetUserPropsParams,
  UserPropsResponse,
  EquippedPropsResponse,
  PropStatus,
} from '~/types/mall/prop'

const log = createLogger('[MallUserProps]')

export function useMallUserProps() {
  // ========================================
  // Dependencies
  // ========================================

  const { api, normalizeError } = useApi()
  const mallStore = useMallStore()

  // ========================================
  // Methods
  // ========================================

  /**
   * Fetch user's owned props.
   */
  async function fetchUserProps(params: GetUserPropsParams = {}, reset = false): Promise<void> {
    // GATE — guards must run before any mutations
    if (mallStore.userProps.loading) return
    if (!reset && !mallStore.userProps.hasMore) return

    // EXECUTE — safe to mutate now
    if (reset) mallStore.resetUserProps()
    mallStore.setUserPropsLoading(true)
    mallStore.setUserPropsError(null)

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 50,
        status: params.status ?? mallStore.currentStatus,
      }

      if (params.type || mallStore.currentType) {
        queryParams.type = params.type ?? mallStore.currentType
      }
      if (mallStore.userProps.cursor) {
        queryParams.cursor = mallStore.userProps.cursor
      }

      const response = await api<UserPropsResponse>('/user/props', { params: queryParams })

      if (reset) {
        mallStore.setUserPropsItems(response.data.props)
      } else {
        mallStore.appendUserPropsItems(response.data.props)
      }

      mallStore.setUserPropsPagination(
        response.data.pagination.next_cursor,
        response.data.pagination.has_more,
      )
    } catch (err) {
      const normalized = normalizeError(err)
      mallStore.setUserPropsError(normalized.message)
    } finally {
      mallStore.setUserPropsLoading(false)
    }
  }

  /**
   * Fetch currently equipped props.
   * Backend caches for 15 minutes.
   */
  async function fetchEquipped(): Promise<void> {
    // GATE
    if (mallStore.equippedLoading) return

    // EXECUTE
    mallStore.setEquippedLoading(true)

    try {
      const response = await api<EquippedPropsResponse>('/user/props/equipped')
      mallStore.setEquipped(response.data.equipped)
    } catch (err) {
    } finally {
      mallStore.setEquippedLoading(false)
    }
  }

  /**
   * Set status filter for user props and refetch.
   */
  async function setStatus(status: PropStatus | 'all'): Promise<void> {
    mallStore.setCurrentStatus(status)
    await fetchUserProps({}, true)
  }

  // ========================================
  // Return
  // ========================================

  return {
    fetchUserProps,
    fetchEquipped,
    setStatus,
  }
}
