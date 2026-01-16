export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  // If not authenticated, redirect to login
  if (!authStore.isAuthenticated) {
    return navigateTo('/log-in')
  }

  // If profile is already complete, redirect to home
  // BootstrapUser uses is_profile_complete directly
  if (authStore.user?.is_profile_complete === true && to.path === '/complete-profile-data') {
    return navigateTo('/')
  }
})
