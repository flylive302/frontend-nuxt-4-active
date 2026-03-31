/**
 * Mall Catalog Composable
 *
 * Data / Query composable for fetching and managing the prop catalog.
 * Handles: fetchTypes, fetchCatalog, setType
 *
 * Pipeline: GATE (guards) → EXECUTE (API + store write) → REACT (none — pure data)
 */
import { createLogger } from '~/utils/logger'
import type {
  PropType,
  GetPropsParams,
  PropListResponse,
  PropTypesResponse,
} from '~/types/mall/prop'

const log = createLogger('[MallCatalog]')

export function useMallCatalog() {
  // ========================================
  // Dependencies
  // ========================================

  const { api, normalizeError } = useApi()
  const mallStore = useMallStore()

  // ========================================
  // Methods
  // ========================================

  /**
   * Fetch prop types with counts.
   * Backend caches for 5 minutes.
   */
  async function fetchTypes(): Promise<void> {
    // GATE
    if (mallStore.typesLoading) return

    // EXECUTE
    mallStore.setTypesLoading(true)

    try {
      const response = await api<PropTypesResponse>('/props/types')
      log.debug('fetchTypes response:', response)
      mallStore.setTypes(response.data.types)
      mallStore.setLastFetchedAt(Date.now())
    } catch (err) {
      log.error('fetchTypes failed:', err)
    } finally {
      mallStore.setTypesLoading(false)
    }
  }

  /**
   * Fetch catalog props with pagination.
   */
  async function fetchCatalog(params: GetPropsParams = {}, reset = false): Promise<void> {
    // GATE
    if (reset) {
      mallStore.resetCatalog()
    }

    if (!mallStore.catalog.hasMore || mallStore.catalog.loading) return

    // EXECUTE
    mallStore.setCatalogLoading(true)
    mallStore.setCatalogError(null)

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 20,
      }

      if (params.type || mallStore.currentType) {
        queryParams.type = params.type ?? mallStore.currentType
      }
      if (mallStore.catalog.cursor) {
        queryParams.cursor = mallStore.catalog.cursor
      }

      log.debug('fetchCatalog queryParams:', queryParams)
      const response = await api<PropListResponse>('/props', { params: queryParams })
      log.debug('fetchCatalog response:', response)

      if (reset) {
        mallStore.setCatalogItems(response.data.props)
      } else {
        mallStore.appendCatalogItems(response.data.props)
      }

      mallStore.setCatalogPagination(
        response.data.pagination.next_cursor,
        response.data.pagination.has_more,
      )
    } catch (err) {
      const normalized = normalizeError(err)
      mallStore.setCatalogError(normalized.message)
      log.error('fetchCatalog failed:', err)
    } finally {
      mallStore.setCatalogLoading(false)
    }
  }

  /**
   * Set current type filter and refetch catalog.
   */
  async function setType(type: PropType | undefined): Promise<void> {
    mallStore.setCurrentType(type)
    await fetchCatalog({}, true)
  }

  // ========================================
  // Return
  // ========================================

  return {
    fetchTypes,
    fetchCatalog,
    setType,
  }
}
