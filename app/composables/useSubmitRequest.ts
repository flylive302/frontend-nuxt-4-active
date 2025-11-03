// ~/composables/useSubmitRequest.ts
import { ref } from '#imports'
import type { NormalizedError } from './useApi'
import { useApi } from '#imports'

type SubmitOptions = {
    endpoint: string
    method?: 'POST' | 'PUT' | 'PATCH'
    body: FormData | Record<string, unknown>
    asFormData?: boolean // forces multipart encoding even if body is a plain object
    retryPost?: boolean  // default false
    timeoutMs?: number   // default 10_000 (client default)
}

function toFormData(payload: FormData | Record<string, unknown>): FormData {
    if (payload instanceof FormData) return payload
    const fd = new FormData()
    for (const [key, value] of Object.entries(payload)) {
        if (Array.isArray(value)) {
            value.forEach((entry) => fd.append(`${key}[]`, entry as any))
        } else if (value != null) {
            fd.append(key, value as any)
        }
    }
    return fd
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
            const shouldUseFormData =
                opts.asFormData ?? (typeof FormData !== 'undefined' && opts.body instanceof FormData)
            const payload = shouldUseFormData
                ? toFormData(opts.body)
                : JSON.stringify(opts.body ?? {})
            if (!shouldUseFormData) headers.set('Content-Type', 'application/json')

            const request = () =>
                api<T>(opts.endpoint, {
                    method: opts.method ?? 'POST',
                    body: shouldUseFormData ? (payload as FormData) : payload,
                    signal: controller!.signal,
                    headers,
                    timeout: opts.timeoutMs
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
            controller = null
        }
    }

    function abort() {
        if (controller) {
            controller.abort()
            controller = null
            isSubmitting.value = false
        }
    }

    function mapError(error: unknown): NormalizedError {
        return normalizeError(error)
    }

    return { submit, abort, isSubmitting, mapError }
}
