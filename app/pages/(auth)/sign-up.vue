<script setup lang="ts">
import { z } from 'zod'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
  authHeading: 'Create a new FlyLive account',
  pageTransition: false,
  layoutTransition: false,
})

useThemeColor('#000002')
useSeoMeta({
  title: 'Sign Up — FlyLive',
  description: 'Create your FlyLive account to join live audio rooms, connect with hosts, and start broadcasting.',
  ogTitle: 'Sign Up — FlyLive',
  ogDescription: 'Create your FlyLive account to join live audio rooms, connect with hosts, and start broadcasting.',
  ogType: 'website',
  robots: 'index, follow',
})

const ROUTES = {
  LOGIN: '/log-in',
} as const

const { register } = useAuthActions()

const formRef = ref<Form<RegistrationFormData> | null>(null)
const { isSubmitting, generalError, handleSubmit } = useAuthForm({ formRef })

const state = reactive({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
})

const registrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string()
    .min(8, 'Must be at least 8 characters')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/[0-9]/, 'Add a number')
    .regex(/[^A-Za-z0-9]/, 'Add a symbol'),
  password_confirmation: z.string(),
}).refine(data => data.password === data.password_confirmation, {
  path: ['password_confirmation'],
  message: 'Passwords do not match',
})

type RegistrationFormData = z.infer<typeof registrationSchema>

async function handleFormSubmit(event: FormSubmitEvent<RegistrationFormData>): Promise<void> {
  await handleSubmit(async () => {
    // register() routes to the email verification screen on success.
    await register(event.data)
  })
}
</script>

<template>
  <div>
    <h2 id="signup-heading" class="sr-only">Create Your Account</h2>

    <UAlert
      v-if="generalError"
      :description="generalError"
      color="error"
      variant="soft"
      title="Registration Failed"
      class="mb-4"
      icon="i-lucide-alert-circle"
    />

    <UForm
      ref="formRef"
      :schema="registrationSchema"
      :state="state"
      :validate-on="['blur', 'change']"
      :disabled="isSubmitting"
      class="space-y-3"
      @submit="handleFormSubmit"
    >
      <UFormField label="Full Name" name="name" required>
        <UInput v-model="state.name" class="w-full" size="lg" icon="i-lucide-user" placeholder="John Doe" :disabled="isSubmitting" />
      </UFormField>

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
          autocomplete="new-password"
          placeholder="********"
          :disabled="isSubmitting"
        />
      </UFormField>

      <UFormField label="Confirm Password" name="password_confirmation" required>
        <FormsPasswordInput
          v-model="state.password_confirmation"
          autocomplete="new-password"
          placeholder="********"
          :show-strength="false"
          :disabled="isSubmitting"
        />
      </UFormField>

      <UButton
        :loading="isSubmitting"
        type="submit"
        size="xl"
        icon="i-lucide-send"
        class="w-full justify-center"
        :disabled="isSubmitting"
      >
        Sign Up
      </UButton>

      <p class="text-xs text-neutral-500 text-center mt-2 leading-relaxed">
        By signing up, you agree to our
        <a href="/privacy-policy" class="text-primary hover:underline">Privacy Policy</a>
        and
        <a href="/terms-of-service" class="text-primary hover:underline">Terms of Service</a>.
        You must be at least 18 years old.
      </p>
    </UForm>

    <UButton
      :to="ROUTES.LOGIN"
      class="mt-3 underline font-bold px-0"
      variant="link"
      trailing-icon="i-lucide-arrow-right"
      size="xl"
      :disabled="isSubmitting"
    >
      Have an Account? Log In
    </UButton>
  </div>
</template>
