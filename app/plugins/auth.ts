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

    // Set token if available (bootstrap plugin will fetch user data)
    if (token.value) {
        authStore.setToken(token.value)
    }
})
