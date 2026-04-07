// ========================================
// Imports & Types
// ========================================
import { ofetch, type FetchContext, type FetchOptions } from 'ofetch'
import { getClientType } from './useClientInfo'

// ========================================
// Types
// ========================================
import { normalizeFetchError, type NormalizedError } from '~/utils/api/normalizeFetchError'

export type { NormalizedError }

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// ========================================
// Module-level Singleton
// ========================================
// CRITICAL: Client must be at module level to reuse connections across calls.

let _client: ReturnType<typeof ofetch.create> | null = null
let _baseURL: string | undefined = undefined

function getClient(baseURL: string | undefined) {
  // Recreate client only if baseURL changed (shouldn't happen in practice)
  if (_client && _baseURL === baseURL) {
    return _client
  }
  
  _baseURL = baseURL
  _client = ofetch.create({
    baseURL,
    timeout: 10_000,
    onRequest({ options }: FetchContext) {
      const headers = new Headers(options.headers || {})
      const cookieToken = useCookie('sanctum_token')
      const xsrfToken = useCookie('XSRF-TOKEN')

      // Fall back to Pinia persisted state if cookie is missing
      // (e.g., PWA reopened after browser cleared session cookies)
      const authStore = useAuthStore()
      const token = cookieToken.value || authStore.token

      // Auth headers
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      if (xsrfToken.value) {
        headers.set('X-XSRF-TOKEN', xsrfToken.value)
      }

      // Standard headers
      headers.set('Accept', 'application/json')

      // Device tracking headers
      headers.set('X-Correlation-ID', crypto.randomUUID())
      headers.set('X-Client-Type', getClientType())

      options.headers = headers
      options.credentials = 'include'
    },
    onResponseError({ response }: FetchContext) {
      // Global 401 interceptor — token expired or invalid
      if (response?.status === 401) {
        // Skip aggressive logout for background MSAB token refreshes.
        // These are opportunistic — failure is handled by the caller (useAuth).
        // Firing logout here would clear ALL tokens and redirect to /log-in
        // before the caller's catch block runs, causing cascading errors.
        const url = response?.url || ''
        if (url.includes('/msab-token/refresh')) return

        const authStore = useAuthStore()
        // Only act if user was previously authenticated (avoid loops on login page)
        if (authStore.token) {
          authStore.logout()
          navigateTo('/log-in')
        }
      }
    }
  })
  
  return _client
}

// ========================================
// Composable
// ========================================

/**
 * Composable for handling API requests with built-in authentication,
 * error normalization, and retry logic.
 * @returns An object containing the api wrapper, the raw client, and error normalization utility.
 */
export function useApi() {
    // ========================================
    // Composables / Injected Dependencies
    // ========================================
    const config = useRuntimeConfig()

    // ========================================
    // Get or create singleton client
    // ========================================
    const client = getClient(config.public.apiBase as string | undefined)

    /**
    * Checks if an HTTP method is safe to retry (GET or HEAD).
    * @param method - The HTTP method to check.
    * @returns True if the method is GET or HEAD, false otherwise.
    */
    function isIdempotent(method?: string): boolean {
    return method === 'GET' || method === 'HEAD'
    }

    /**
    * Performs an API request with automatic retries for idempotent methods on server errors.
    * @param url - The endpoint URL.
    * @param options - Fetch options.
    * @returns The response data.
    */
    async function api<T>(url: string, options: FetchOptions<'json'> = {}): Promise<T> {
    const method = (options.method?.toUpperCase() as HttpMethod) ?? 'GET'
    const tryOnce = () => client<T>(url, options)

    try {
      return await tryOnce()
    } catch (err: unknown) {
      // Only retry for idempotent methods on network/5xx
      if (!isIdempotent(method)) {
        throw err
      }

      // We safely cast to any to inspect the error structure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.response?.status as number | undefined

      if (!status || status >= 500) {
        return await tryOnce()
      }
      throw err
    }
    }

    /**
    * Normalizes an unknown error into a standard format.
    * Handles AbortError, Validation Errors (422), and generic API errors.
    * @param error - The error object to normalize.
    * @returns A NormalizedError object.
    */
    function normalizeError(error: unknown): NormalizedError {
      return normalizeFetchError(error)
    }


    // ========================================
    // Business Logic / Core Logic
    // ========================================

    /**
     * Fetches the CSRF token from the backend.
     * Required before making state-modifying requests (POST, PUT, DELETE).
     */
    async function fetchCsrfToken(): Promise<void> {
        // Remove /api from the end of apiBase to get the root URL
        // We cast to string because we know apiBase is defined in nuxt.config
        const backendUrl = config.public.apiRoot as string

        await api(`${backendUrl}/sanctum/csrf-cookie`, {
            method: 'GET',
        })
    }

    return { api, client, normalizeError, fetchCsrfToken }
}
