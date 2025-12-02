<script setup lang="ts">
import { z } from 'zod'
import { normalizePhone, usePhoneSchema } from '~/composables/usePhoneSchema'
import { useCountries } from '~/composables/useCountries'
import { useAuthForm } from '~/composables/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'
import type { LoginPayload } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

const MIN_PASSWORD_LENGTH = 8 as const
const MAX_PASSWORD_LENGTH = 128 as const

const ROUTES = {
  HOME: '/',
  SIGNUP: '/sign-up',
  FORGOT_PASSWORD: '/forgot-password'
} as const

const ICONS = {
  LOCK: 'i-lucide-lock',
  SEND: 'i-lucide-send',
  ARROW_RIGHT: 'i-lucide-arrow-right'
} as const

const { login } = useAuth()
const { countries } = useCountries()

const state = reactive({
  countryCode: '',
  dialCode: '',
  phone: '',
  password: '',
  rememberMe: false,
})

const form = ref<Form<LoginFormState> | null>(null)

const { isSubmitting, handleSubmit } = useAuthForm({
  formRef: form,
  successMessage: 'Welcome back!',
})

const selectedCountry = computed(() => {
  const country = countries.value.find(c => c.code === state.countryCode)
  return country ? { code: country.code, name: country.name } : undefined
})

const phoneSchema = usePhoneSchema(selectedCountry)

const loginSchema = computed(() => {
  const baseSchema = z.object({
    password: z.string()
      .min(MIN_PASSWORD_LENGTH, 'Must be at least 8 characters')
      .max(MAX_PASSWORD_LENGTH, 'Password may not exceed 128 characters'),
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
    const { password, rememberMe, dialCode, phone, countryCode } = event.data

    const loginPayload: LoginPayload = {
      phone: normalizePhone(dialCode, phone),
      phone_country: countryCode,
      country_code: dialCode,
      password,
      remember_me: rememberMe
    }

    await login(loginPayload)
    await navigateTo(ROUTES.HOME)
  })
}
</script>

<template>
  <main aria-labelledby="login-heading">
    <h1 id="login-heading" class="sr-only">Log In to Your Account</h1>

    <UForm ref="form" :schema="loginSchema" :state="state" :validate-on="['blur']" :disabled="isSubmitting"
      class="space-y-3" @submit="onSubmit">
      <FormsCountryPhoneInput v-model:country-code="state.countryCode" v-model:dial-code="state.dialCode"
        v-model:phone="state.phone" :disabled="isSubmitting" />

      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" class="w-full" size="lg" :icon="ICONS.LOCK" type="password"
          autocomplete="current-password" placeholder="Enter your password" :maxlength="MAX_PASSWORD_LENGTH"
          :disabled="isSubmitting" aria-label="Password" />
      </UFormField>

      <div class="flex items-center justify-between">
        <UCheckbox v-model="state.rememberMe" label="Remember me" :disabled="isSubmitting" />

        <NuxtLink :to="ROUTES.FORGOT_PASSWORD" class="text-sm font-medium text-primary hover:underline"
          :tabindex="isSubmitting ? -1 : 0">
          Forgot password?
        </NuxtLink>
      </div>

      <UButton type="submit" size="xl" class="w-full justify-center" :icon="ICONS.SEND" :loading="isSubmitting"
        :disabled="isSubmitting" aria-label="Log in">
        Log In
      </UButton>
    </UForm>

    <UButton :to="ROUTES.SIGNUP" class="mt-3 underline font-bold px-0" variant="link" :trailing-icon="ICONS.ARROW_RIGHT"
      size="xl" :disabled="isSubmitting">
      Create an Account
    </UButton>
  </main>
</template>