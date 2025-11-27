import { defineStore } from 'pinia'
import type { User } from '~/types/auth'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null as User | null,
        token: null as string | null,
        status: 'idle' as 'idle' | 'loading' | 'authenticated' | 'unauthenticated',
    }),
    getters: {
        isAuthenticated: (state) => !!state.token && !!state.user,
    },
    actions: {
        setUser(user: User | null) {
            this.user = user
            this.status = user ? 'authenticated' : 'unauthenticated'
        },
        setToken(token: string | null) {
            this.token = token
            // Sync with cookie
            const cookie = useCookie('sanctum_token')
            cookie.value = token
        },
        async fetchUser() {
            this.status = 'loading'
            try {
                const { api } = useApi()
                const { data } = await api<{ data: User }>('/v1/auth/user')
                this.setUser(data)
            } catch (error) {
                this.setUser(null)
                this.setToken(null)
            } finally {
                if (this.status === 'loading') {
                    this.status = this.user ? 'authenticated' : 'unauthenticated'
                }
            }
        },
        logout() {
            this.setUser(null)
            this.setToken(null)
            this.status = 'unauthenticated'
        },
    },
    persist: {
        paths: ['user', 'token']
    }
})
