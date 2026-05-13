<script setup lang="ts">
import { z } from 'zod'
import { normalizePhone, usePhoneSchema } from '~/composables/auth/usePhoneSchema'
import { useCountries } from '~/composables/shared/useCountries'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'
import type { LoginPayload } from '~/types/user/auth'
const FormsCountryPhoneInput = defineAsyncComponent(
    () => import('~/components/forms/country-phone-input.vue')
)

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
  FORGOT_PASSWORD: '/forgot-password'
} as const

const { login } = useAuthActions()
const { countries } = useCountries()

const form = ref<Form<LoginFormState> | null>(null)

const { isSubmitting, generalError, getFieldError, handleSubmit } = useAuthForm({ formRef: form })

const phoneError = computed(() => getFieldError('phone'))

const state = reactive({
  countryCode: '',
  dialCode: '',
  phone: '',
  password: '',
  rememberMe: false,
})

const selectedCountry = computed(() => {
  const country = countries.value.find(c => c.code === state.countryCode)
  return country ? { code: country.code, name: country.name } : undefined
})

const phoneSchema = usePhoneSchema(selectedCountry)

const loginSchema = computed(() => {
  const baseSchema = z.object({
    password: z.string(),
    rememberMe: z.boolean().default(false),
  })

  return z.intersection(baseSchema, phoneSchema.value)
})

type LoginFormState = z.infer<typeof loginSchema.value>

/**
 * Handles login form submission with comprehensive error handling
 */
async function onSubmit(event: FormSubmitEvent<LoginFormState>): Promise<void> {
  await handleSubmit(async () => {
    const { password, dialCode, phone, countryCode } = event.data

    const loginPayload: LoginPayload = {
      phone: normalizePhone(dialCode, phone),
      country: countryCode,
      password
    }

    await login(loginPayload, ROUTES.HOME)
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
      <FormsCountryPhoneInput
        v-model:country-code="state.countryCode"
        v-model:dial-code="state.dialCode"
        v-model:phone="state.phone"
        :disabled="isSubmitting"
        :error="phoneError"
      />

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