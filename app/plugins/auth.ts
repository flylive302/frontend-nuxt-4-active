export default defineNuxtPlugin(async () => {
    const authStore = useAuthStore()
    const token = useCookie('sanctum_token')

    // If we have a token but no user (e.g. hard refresh), try to fetch user
    if (token.value && !authStore.user) {
        authStore.setToken(token.value)
        await authStore.fetchUser()
    }
})
