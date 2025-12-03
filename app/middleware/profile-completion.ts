export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  // If not authenticated, redirect to login
  if (!authStore.isAuthenticated) {
    return navigateTo('/log-in')
  }

  // If profile is already complete, redirect to home
  // We check if we are NOT already on the complete-profile-data page to avoid loops (though this middleware is likely applied TO that page)
  if (authStore.user?.profile_completion?.is_complete === true && to.path === '/complete-profile-data') {
    return navigateTo('/')
  }
})
