<script setup lang="ts">
import type { SocialProvider } from '~/types/user/auth'

const { getSocialRedirectUrl } = useAuth()

const isLoading = ref<SocialProvider | null>(null)

const providers: { name: SocialProvider; icon: string; label: string }[] = [
  { name: 'google', icon: 'i-logos-google-icon', label: 'Google' },
  { name: 'facebook', icon: 'i-logos-facebook', label: 'Facebook' },
  { name: 'apple', icon: 'i-simple-icons-apple', label: 'Apple' },
]

async function loginWith(provider: SocialProvider) {
  if (isLoading.value) return

  isLoading.value = provider
  try {
    const redirectUrl = await getSocialRedirectUrl(provider)
    window.location.href = redirectUrl
  } catch {
    const toast = useToast()
    toast.add({
      title: `Failed to connect with ${provider}`,
      color: 'error',
    })
  } finally {
    // Keep loading state — page will redirect away
    // Only clear if it failed (caught above)
    setTimeout(() => {
      isLoading.value = null
    }, 5000)
  }
}
</script>

<template>
  <div>
    <SectionTitle>Login With:</SectionTitle>

    <div class="flex justify-between mt-2">
      <UButton
        v-for="provider in providers"
        :key="provider.name"
        variant="subtle"
        size="xl"
        :square="true"
        :loading="isLoading === provider.name"
        :disabled="isLoading !== null && isLoading !== provider.name"
        @click="loginWith(provider.name)"
      >
        <UIcon :name="provider.icon" class="size-8" />
      </UButton>
    </div>
  </div>
</template>