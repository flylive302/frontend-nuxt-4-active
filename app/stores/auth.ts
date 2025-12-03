import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '~/types/auth';

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);
    const token = ref<string | null>(null);
    const status = ref<'idle' | 'loading' | 'authenticated' | 'unauthenticated'>('idle');
    const permissions = ref<string[]>([]);    
    const isAuthenticated = computed(() => !!token.value && !!user.value);

    function setUser(newUser: User | null) {
        user.value = newUser;
        status.value = newUser ? 'authenticated' : 'unauthenticated';
    }
    function setPermissions(newPermissions: string[]) {
        permissions.value = newPermissions;
    }
    function setToken(newToken: string | null) {
        token.value = newToken;
        // Sync with cookie
        const cookie = useCookie('sanctum_token');
        cookie.value = newToken;
    }

    async function testApi(): Promise<void> {
        const {api} = useApi();
        try {
            const results = await api('/auth/test');
            console.log(results);
        } catch (error) {
            console.error('API test failed:', error);
        }
    }    
    
    async function fetchUser() {
        status.value = 'loading';
        try {
            const { api } = useApi();
            const { data } = await api<{ data: User }>('/auth/user');
            setUser(data);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            setUser(null);
            setToken(null);
        } finally {
            if (status.value === 'loading') {
                status.value = user.value ? 'authenticated' : 'unauthenticated';
            }
        }
    }

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
        permissions,
        setUser,
        testApi,
        setPermissions,
        setToken,
        fetchUser,
        logout
    };
}, {
    persist: {
        pick: ['user', 'token'],
    }
});
