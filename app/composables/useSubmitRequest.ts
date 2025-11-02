// ~/composables/useSubmitRequest.ts
import type { NormalizedError } from './useApi'

type SubmitOptions = {
    endpoint: string
    method?: 'POST' | 'PUT' | 'PATCH'
    body: FormData | Record<string, unknown>
    asFormData?: boolean // informational only; header selection happens below
    retryPost?: boolean  // default false
    timeoutMs?: number   // default 10_000 (client default)
}

export function useSubmitRequest() {
    const { api, normalizeError } = useApi()
    const isSubmitting = ref(false)
    let controller: AbortController | null = null

    async function submit<T = unknown>(opts: SubmitOptions): Promise<T> {
        if (isSubmitting.value) throw new Error('Already submitting')

        try {
            isSubmitting.value = true
            controller?.abort()
            controller = new AbortController()

            const headers = new Headers()
            // Let the browser set multipart boundary for FormData (do NOT set Content-Type)
            const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData
            if (!isForm) headers.set('Content-Type', 'application/json')

            const request = () =>
                api<T>(opts.endpoint, {
                    method: opts.method ?? 'POST',
                    body: isForm ? (opts.body as FormData) : JSON.stringify(opts.body ?? {}),
                    signal: controller!.signal,
                    headers
                })

            try {
                return await request()
            } catch (error: unknown) {
                // Optional single retry for POST only if explicitly requested
                if (opts.retryPost) return await request()
                throw error
            }
        } finally {
            isSubmitting.value = false
        }
    }

    function abort() {
        controller?.abort()
    }

    function mapError(error: unknown): NormalizedError {
        return normalizeError(error)
    }

    return { submit, abort, isSubmitting, mapError }
}
