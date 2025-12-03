export default defineNuxtRouteMiddleware(() => {
    const authStore = useAuthStore()

    if (!authStore.isAuthenticated) {
        return navigateTo('/log-in')
    }

    if (!authStore.user?.profile_completion?.is_complete) {
        return navigateTo('/complete-profile-data')
    }
})