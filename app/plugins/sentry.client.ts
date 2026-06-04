import * as Sentry from '@sentry/nuxt'

// Set Sentry user context on auth changes — user ID only, no PII
export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()

  watchEffect(() => {
    if (authStore.user?.id) {
      Sentry.setUser({ id: String(authStore.user.id) })
    } else {
      Sentry.setUser(null)
    }
  })
})
