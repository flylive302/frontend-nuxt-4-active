<script setup lang="ts">
import { z } from 'zod'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
  authHeading: 'Login To Your Flylive Account',
  pageTransition: false,
  layoutTransition: false,
})

// SEO — rendered server-side for crawler and Lighthouse SEO score
useSeoMeta({
  title: 'Log In — FlyLive',
  description: 'Log in to FlyLive to join live audio rooms, send gifts, and connect with hosts worldwide.',
  ogTitle: 'Log In — FlyLive',
  ogDescription: 'Log in to FlyLive to join live audio rooms, send gifts, and connect with hosts worldwide.',
  ogType: 'website',
  ogUrl: 'https://flyliveapp.com/log-in',
  ogSiteName: 'FlyLive',
  robots: 'index, follow',
})

const ROUTES = {
  HOME: '/',
  SIGNUP: '/sign-up',
  FORGOT_PASSWORD: '/forgot-password',
} as const

const { login } = useAuthActions()

const form = ref<Form<LoginFormState> | null>(null)
const { isSubmitting, generalError, handleSubmit } = useAuthForm({ formRef: form })

const state = reactive({
  email: '',
  password: '',
  rememberMe: false,
})

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
})

type LoginFormState = z.infer<typeof loginSchema>

async function onSubmit(event: FormSubmitEvent<LoginFormState>): Promise<void> {
  // login() handles the unverified case by redirecting to /verify-email.
  await handleSubmit(async () => {
    await login({ email: event.data.email, password: event.data.password }, ROUTES.HOME)
  })
}
</script>

<template>
  <div>
    <h2 id="login-heading" class="sr-only">Log In to Your Account</h2>

    <UAlert
      v-if="generalError"
      :description="generalError"
      color="error"
      variant="soft"
      title="Login Failed"
      class="mb-4"
      icon="i-lucide-alert-circle"
    />

    <UForm
      ref="form"
      :schema="loginSchema"
      :state="state"
      :validate-on="['blur', 'change']"
      :disabled="isSubmitting"
      class="space-y-3"
      @submit="onSubmit"
    >
      <UFormField label="Email" name="email" required>
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="email"
          class="w-full"
          size="lg"
          icon="i-lucide-mail"
          placeholder="you@example.com"
          :disabled="isSubmitting"
        />
      </UFormField>

      <UFormField label="Password" name="password" required>
        <FormsPasswordInput
          v-model="state.password"
          autocomplete="current-password"
          placeholder="Enter your password"
          :disabled="isSubmitting"
          :show-strength="false"
          aria-label="Password"
        />
      </UFormField>

      <div class="flex items-center justify-between">
        <UCheckbox
          v-model="state.rememberMe"
          label="Remember me"
          :disabled="isSubmitting"
        />
        <NuxtLink
          :to="ROUTES.FORGOT_PASSWORD"
          :tabindex="isSubmitting ? -1 : 0"
          class="text-sm font-medium text-primary hover:underline"
        >
          Forgot password?
        </NuxtLink>
      </div>

      <UButton
        type="submit" size="xl"
        class="w-full justify-center bg-primary-700 hover:bg-primary-800"
        icon="i-lucide-send"
        :loading="isSubmitting"
        :disabled="isSubmitting"
        aria-label="Log in"
      >
        Log In
      </UButton>
    </UForm>

    <UButton
      :to="ROUTES.SIGNUP"
      class="mt-3 underline font-bold px-0"
      variant="link"
      trailing-icon="i-lucide-arrow-right"
      size="xl"
      :disabled="isSubmitting"
    >
      Create an Account
    </UButton>
  </div>
</template>
