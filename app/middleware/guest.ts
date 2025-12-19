export default defineNuxtRouteMiddleware((_to) => {
    const authStore = useAuthStore()

    if (authStore.isAuthenticated) {
        return navigateTo('/')
    }
})
