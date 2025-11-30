import type { AuthResponse, User } from '~/types/auth'

export function useAuth() {
    const authStore = useAuthStore()
    const { api } = useApi()
    const toast = useToast()

    async function fetchCsrfToken() {
        const config = useRuntimeConfig()
        // Remove /api from the end of apiBase to get the root URL
        const backendUrl = (config.public.apiBase as string).replace(/\/api$/, '')

        await api(`${backendUrl}/sanctum/csrf-cookie`, {
            method: 'GET',
        })
    }

    async function login(credentials: Record<string, any>) {
        try {
            await fetchCsrfToken()
            const { data } = await api<{ data: AuthResponse }>('/v1/auth/login', {
                method: 'POST',
                body: credentials,
            })

            authStore.setToken(data.token)
            authStore.setUser(data.user)

            toast.add({ title: 'Welcome back!', color: 'success' })
            return true
        } catch (error: any) {
            // Errors are handled by the caller or global handler usually, 
            // but we can rethrow or handle specific cases here
            throw error
        }
    }

    async function register(payload: Record<string, any>) {
        try {
            await fetchCsrfToken()
            const { data } = await api<{ data: AuthResponse }>('/v1/auth/register', {
                method: 'POST',
                body: payload,
            })

            authStore.setToken(data.token)
            authStore.setUser(data.user)

            toast.add({ title: 'Account created!', color: 'success' })
            return true
        } catch (error) {
            throw error
        }
    }

    async function logout() {
        try {
            await api('/v1/auth/logout', { method: 'POST' })
        } catch (e) {
            // Ignore logout errors
        } finally {
            authStore.logout()
            navigateTo('/log-in')
        }
    }

    async function updateProfile(payload: Partial<User>) {
        try {
            const { data } = await api<{ data: User }>('/v1/profile', {
                method: 'PUT',
                body: payload
            })
            authStore.setUser(data)
            toast.add({ title: 'Profile updated', color: 'success' })
            return true
        } catch (error) {
            throw error
        }
    }

    return {
        login,
        register,
        logout,
        updateProfile
    }
}
