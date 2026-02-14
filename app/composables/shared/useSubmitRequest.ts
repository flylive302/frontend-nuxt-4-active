// ========================================
// Imports & Types
// ========================================
import { useApi, type NormalizedError } from './useApi'

// ========================================
// Types
// ========================================
export interface SubmitOptions {
  endpoint: string
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: FormData | Record<string, unknown> | null
  asFormData?: boolean // forces multipart encoding even if body is a plain object
  retryPost?: boolean // default false
  timeoutMs?: number // default 10_000 (client default)
}

// ========================================
// Helpers / Utilities
// ========================================

/**
 * Converts a payload object into a FormData instance.
 * Handles arrays by appending multiple entries with the same key (suffixed with []).
 * @param payload - The data to convert.
 * @returns A FormData object containing the payload data.
 */
function toFormData(payload: FormData | Record<string, unknown>): FormData {
  if (payload instanceof FormData) return payload

  const fd = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        fd.append(`${key}[]`, entry instanceof Blob ? entry : String(entry))
      })
    } else if (value != null) {
      fd.append(key, value instanceof Blob ? value : String(value))
    }  }
  return fd
}

// ========================================
// Composable
// ========================================

/**
 * Composable for handling API form submissions with built-in state management and cancellation.
 * @returns An object containing the submit function, abort function, submission state, and error mapper.
 */
export function useSubmitRequest() {
  // ========================================
  // Composables / Injected Dependencies
  // ========================================
  const { api, normalizeError } = useApi()

  // ========================================
  // Component State
  // ========================================
  const isSubmitting = ref(false)
  let controller: AbortController | null = null

  // ========================================
  // Business Logic / Core Logic
  // ========================================

  /**
   * Submits data to the specified endpoint.
   * Handles FormData conversion, content-type headers, and request cancellation.
   * @param opts - Configuration options for the request.
   * @returns The response data from the API.
   * @throws Error if a submission is already in progress.
   */
  async function submit<T = unknown>(opts: SubmitOptions): Promise<T> {
    if (isSubmitting.value) {
      throw new Error('Already submitting')
    }

    try {
      isSubmitting.value = true
      controller?.abort()
      controller = new AbortController()

      const headers = new Headers()
      const shouldUseFormData =
        opts.asFormData ?? (typeof FormData !== 'undefined' && opts.body instanceof FormData)

      const payload = shouldUseFormData && opts.body
        ? toFormData(opts.body)
        : JSON.stringify(opts.body ?? {})

      if (!shouldUseFormData) {
        headers.set('Content-Type', 'application/json')
      }

      const request = () =>
        api<T>(opts.endpoint, {
          method: opts.method ?? 'POST',
          body: shouldUseFormData ? (payload as FormData) : payload,
          signal: controller!.signal,
          headers,
          timeout: opts.timeoutMs,
        })

      try {
        return await request()
      } catch (error: unknown) {
        // Optional single retry for POST only if explicitly requested
        if (opts.retryPost) {
          return await request()
        }
        throw error
      }
    } finally {
      isSubmitting.value = false
      controller = null
    }
  }

  /**
   * Aborts the current submission request if one is in progress.
   */
  function abort(): void {
    if (controller) {
      controller.abort()
      controller = null
      isSubmitting.value = false
    }
  }

  /**
   * Maps an unknown error to a normalized error object.
   * @param error - The error to normalize.
   * @returns A NormalizedError object.
   */
  function mapError(error: unknown): NormalizedError {
    return normalizeError(error)
  }

  return {
    submit,
    abort,
    isSubmitting,
    mapError,
  }
}
