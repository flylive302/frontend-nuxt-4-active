// ~/composables/useApi.ts
import { ofetch, type FetchContext, type FetchOptions } from 'ofetch'
import { useRuntimeConfig, useCookie } from '#imports'

export type NormalizedError = {
    status?: number
    message: string
    fieldErrors?: Record<string, string[]>
    raw?: unknown
}

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export function useApi() {
    const config = useRuntimeConfig()
    const token = useCookie<string | null>('sanctum_token')

    const client = ofetch.create({
        baseURL: config.public.apiBase as string | undefined,
        timeout: 10_000,
        onRequest({ options }: FetchContext) {
            const headers = new Headers(options.headers || {})
            const token = useCookie('sanctum_token')
            const xsrfToken = useCookie('XSRF-TOKEN')

            if (token.value) headers.set('Authorization', `Bearer ${token.value}`)
            if (xsrfToken.value) headers.set('X-XSRF-TOKEN', xsrfToken.value)

            headers.set('Accept', 'application/json')
            headers.set('Referer', 'http://localhost:3000')

            options.headers = headers
            options.credentials = 'include'
        }
    })

    function isIdempotent(method?: string) {
        return method === 'GET' || method === 'HEAD'
    }

    async function api<T>(url: string, options: FetchOptions<'json'> = {}): Promise<T> {
        const method = (options.method?.toUpperCase() as HttpMethod) ?? 'GET'
        const tryOnce = () => client<T>(url, options)

        try {
            return await tryOnce()
        } catch (err: unknown) {
            // Only retry for idempotent methods on network/5xx
            if (!isIdempotent(method)) throw err

            const status = (err as any)?.response?.status as number | undefined
            if (!status || status >= 500) {
                return await tryOnce()
            }
            throw err
        }
    }

    function normalizeError(error: unknown): NormalizedError {
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

    return { api, client, normalizeError }
}
