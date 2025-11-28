export default defineNuxtRouteMiddleware(() => {
    const authStore = useAuthStore()

    if (!authStore.isAuthenticated) {
        return navigateTo('/log-in')
    }
})
