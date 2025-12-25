import { defineStore } from 'pinia';
import type { User } from '~/types/auth';

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);
    const token = ref<string | null>(null);
    const status = ref<'idle' | 'loading' | 'authenticated' | 'unauthenticated'>('idle');
    const isAuthenticated = computed(() => !!token.value && !!user.value);

    /**
     * Update the authenticated user.
     * @param newUser - User object or null to clear
     */
    function setUser(newUser: User | null) {
        user.value = newUser;
        status.value = newUser ? 'authenticated' : 'unauthenticated';
    }
    /**
     * Set authentication token and sync with cookie.
     * @param newToken - JWT token or null to clear
     */
    function setToken(newToken: string | null) {
        token.value = newToken;
        // Sync with cookie
        const cookie = useCookie('sanctum_token');
        cookie.value = newToken;
    }
    
    /**
     * Fetch authenticated user from API.
     * Updates store with user data or clears on failure.
     */
    async function fetchUser() {
        status.value = 'loading';
        try {
            const { api } = useApi();
            const { data } = await api<{ data: User }>('/auth/user');
            setUser(data);
        } catch {
            setUser(null);
            setToken(null);
        } finally {
            if (status.value === 'loading') {
                status.value = user.value ? 'authenticated' : 'unauthenticated';
            }
        }
    }

    /**
     * Log out the current user, clear state, and navigate to login.
     */
    function logout() {
        setUser(null);
        setToken(null);
        status.value = 'unauthenticated';
        navigateTo('/log-in');
    }

    return {
        user,
        token,
        status,
        isAuthenticated,
        setUser,
        setToken,
        fetchUser,
        logout
    };
}, {
    persist: {
        pick: ['user', 'token'],
    }
});
