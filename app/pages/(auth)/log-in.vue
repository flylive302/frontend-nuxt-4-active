<script setup lang="ts">
import { z } from 'zod'
import { normalizePhone, usePhoneSchema } from '~/composables/usePhoneSchema'
import { useCountries } from '~/composables/useCountries'
import { useAuthForm } from '~/composables/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'
import type {LoginPayload} from "~/types/auth";
import SocialAuth from "~/components/social-auth.vue";

definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

// Min/Max password length handled by backend and component visual feedback

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
    const { password, rememberMe, dialCode, phone, countryCode } = event.data

    const loginPayload: LoginPayload = {
      phone: normalizePhone(dialCode, phone),
      country: countryCode,
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

    <SocialAuth />

    <USeparator color="primary" class="my-4" label="OR" />

    <h1 id="login-heading" class="sr-only">Log In to Your Account</h1>

    <!-- General error alert - displayed at top of form when login fails -->
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
          class="w-full justify-center"
          :icon="ICONS.SEND"
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
        :trailing-icon="ICONS.ARROW_RIGHT"
        size="xl"
        :disabled="isSubmitting"
    >
      Create an Account
    </UButton>
  </main>
</template>