/**
 * Auth Plugin - Token Initialization
 *
 * Sets auth token from cookie on app start.
 * Bootstrap plugin handles fetching user data.
 *
 * @see plugins/bootstrap.client.ts
 */
export default defineNuxtPlugin(() => {
    const authStore = useAuthStore()
    const token = useCookie('sanctum_token')

    // Set token if available and not already set (avoids cookie→store→cookie cycle)
    if (token.value && token.value !== authStore.token) {
        authStore.setToken(token.value)
    }
})
