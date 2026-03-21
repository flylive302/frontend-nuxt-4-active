<script setup lang="ts">
/**
 * OAuth Callback Page
 *
 * Handles the redirect back from social auth providers.
 * Delegates all business logic to useOAuthCallback composable.
 * This page only reads query params, calls the composable, and navigates.
 */
definePageMeta({
  layout: 'auth',
})

const route = useRoute()
const { handleCallback } = useOAuthCallback()

const error = ref<string | null>(null)
const isProcessing = ref(true)

onMounted(async () => {
  try {
    const result = await handleCallback({
      token: route.query.token as string | undefined,
      msabToken: route.query.msab_token as string | undefined,
      error: route.query.error as string | undefined,
      isNew: route.query.is_new === 'true',
    })

    if (!result.success) {
      error.value = result.error ?? 'Authentication failed.'
      return
    }

    await navigateTo(result.redirectTo, { replace: true })
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
