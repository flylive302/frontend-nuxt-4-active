// ========================================
// Imports & Types
// ========================================
import { ofetch, type FetchContext, type FetchOptions } from 'ofetch'
import { getClientType } from './useClientInfo'

// ========================================
// Types
// ========================================
export interface NormalizedError {
  status?: number
  message: string
  fieldErrors?: Record<string, string[]>
  raw?: unknown
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = error as any
    const status: number | undefined = e?.response?.status
    const data = e?.response?._data ?? e?.data

    if (e?.name === 'AbortError') {
      return { status, message: 'Request was cancelled.', raw: error }
    }

    if (status === 422 && data) {
      const fieldErrors: Record<string, string[]> | undefined = data.errors
      const message: string = data.message || 'Validation failed'
      return { status, message, fieldErrors, raw: error }
    }

    if (status) {
      const message: string =
        data?.message || data?.error || e?.message || 'Request failed.'
      return { status, message, raw: error }
    }

    return { message: 'Network error. Check your connection.', raw: error }
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
