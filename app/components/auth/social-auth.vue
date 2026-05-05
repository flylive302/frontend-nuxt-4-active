<script setup lang="ts">
import type { SocialProvider } from '~/types/user/auth'

const { startSocialLogin } = useAuthActions()

const isLoading = ref<SocialProvider | null>(null)

const providers: { name: SocialProvider; icon: string; label: string }[] = [
  { name: 'google', icon: 'i-logos-google-icon', label: 'Google' },
  { name: 'facebook', icon: 'i-logos-facebook', label: 'Facebook' },
  { name: 'apple', icon: 'i-simple-icons-apple', label: 'Apple' }
]

async function loginWith(provider: SocialProvider) {
  if (isLoading.value) return

  isLoading.value = provider
  await startSocialLogin(provider)
  // Keep loading — page will redirect away on success.
  // Clear after timeout in case of silent failure.
  setTimeout(() => {
    isLoading.value = null
  }, 5000)
}
</script>

<template>
  <div class="flex justify-between">
    <div 
      v-for="provider in providers"
      :key="provider.name"
      class="rounded-lg aspect-square glowing-border">
      <UButton
        variant="solid"
        color="neutral"
        size="xl"
        class="inset-shadow-sm inset-shadow-neutral-950/50 size-full"
        :square="true"
        :aria-label="`Sign in with ${provider.label}`"
        :loading="isLoading === provider.name"
        :disabled="isLoading !== null && isLoading !== provider.name"
        @click="loginWith(provider.name)"
      >
        <UIcon v-show="isLoading !== provider.name" :name="provider.icon" class="size-8" />
      </UButton>
    </div>
  </div>
</template>