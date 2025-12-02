export default defineNuxtRouteMiddleware(() => {
    const authStore = useAuthStore()

    if (!authStore.isAuthenticated) {
        return navigateTo('/log-in')
    }

    if (authStore.user?.date_of_birth == null || authStore.user?.gender == null || authStore.user?.signature == null){
        return navigateTo('/complete-profile-data')
    }
})