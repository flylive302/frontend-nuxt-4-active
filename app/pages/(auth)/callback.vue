<script setup lang="ts">
/**
 * OAuth Callback Page
 *
 * Handles the redirect back from social auth providers.
 * The backend redirects here with token and msab_token
 * as query parameters after successful OAuth flow.
 *
 * NOTE: We can't use bootstrapStore.fetchBootstrap() here because the API
 * client reads the token from useCookie('sanctum_token'), which isn't
 * available in the same tick after setToken(). Instead, we make a direct
 * fetch with the Bearer token in the Authorization header.
 */
definePageMeta({
  layout: 'auth',
})

const route = useRoute()
const config = useRuntimeConfig()
const authStore = useAuthStore()
const levelsStore = useLevelsStore()
const toast = useToast()

const error = ref<string | null>(null)
const isProcessing = ref(true)

onMounted(async () => {
  try {
    const token = route.query.token as string | undefined
    const msabToken = route.query.msab_token as string | undefined
    const errorMsg = route.query.error as string | undefined
    const isNew = route.query.is_new === 'true'

    if (errorMsg) {
      error.value = errorMsg
      isProcessing.value = false
      return
    }

    if (!token) {
      error.value = 'Authentication failed. No token received.'
      isProcessing.value = false
      return
    }

    // Store the tokens
    authStore.setToken(token)
    if (msabToken) {
      authStore.setMsabToken(msabToken)
    }

    // Fetch user data with explicit Authorization header.
    // The cookie-based API client can't read the just-set cookie in the same tick,
    // so we bypass it with a direct fetch.
    const apiBase = config.public.apiBase as string
    const response = await $fetch<{ data: { user: any; user_data: any } }>(`${apiBase}/bootstrap`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      credentials: 'include',
    })

    if (response?.data?.user) {
      authStore.setUser(response.data.user)
      if (response.data.user_data?.levels) {
        levelsStore.setLevels(response.data.user_data.levels.wealth, response.data.user_data.levels.charm)
      }
    }

    toast.add({
      title: isNew ? 'Account created!' : 'Welcome back!',
      color: 'success',
    })

    // Redirect — new users go to complete profile, existing users go home
    await navigateTo(isNew ? '/complete-profile-data' : '/', { replace: true })
  } catch {
    error.value = 'Something went wrong during authentication.'
  } finally {
    isProcessing.value = false
  }
})
</script>


<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <div v-if="isProcessing" class="text-center">
      <UIcon name="i-heroicons-arrow-path" class="size-10 animate-spin text-primary" />
      <p class="mt-4 text-lg text-gray-400">Completing sign in...</p>
    </div>

    <div v-else-if="error" class="text-center max-w-md">
      <UIcon name="i-heroicons-exclamation-triangle" class="size-12 text-red-500" />
      <p class="mt-4 text-lg text-red-400">{{ error }}</p>
      <UButton
        class="mt-6"
        variant="solid"
        color="primary"
        @click="navigateTo('/log-in', { replace: true })"
      >
        Back to Login
      </UButton>
    </div>
  </div>
</template>
