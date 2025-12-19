<script setup lang="ts">

import { z } from 'zod'
import { computed, reactive, ref } from 'vue'
import { navigateTo } from 'nuxt/app'
import { normalizePhone, usePhoneSchema } from '~/composables/usePhoneSchema'
import { useCountries } from '~/composables/useCountries'
import { useAuthForm } from '~/composables/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

const VALIDATION_MESSAGES = {
  NAME_MIN_LENGTH: 'Name must be at least 2 characters',
  PASSWORD_MIN_LENGTH: 'Must be at least 8 characters',
  PASSWORD_LOWERCASE: 'Must contain at least one lowercase letter',
  PASSWORD_UPPERCASE: 'Must contain at least one uppercase letter',
  PASSWORD_NUMBER: 'Must contain at least one number',
  PASSWORD_SPECIAL: 'Must contain at least one special character',
} as const

const FIELD_CONSTRAINTS = {
  NAME_MIN_LENGTH: 2,
  PASSWORD_MIN_LENGTH: 8,
} as const

const PASSWORD_REGEX = {
  LOWERCASE: /[a-z]/,
  UPPERCASE: /[A-Z]/,
  NUMBER: /\d/,
  SPECIAL: /[\W_]/,
} as const

const ROUTES = {
  COMPLETE_PROFILE: '/complete-profile-data',
  LOGIN: '/log-in',
} as const

const { register } = useAuth()
const { countries } = useCountries()

const formRef = ref<Form<RegistrationFormData> | null>(null)

const { isSubmitting: isProcessing, generalError: generalErrorMessage, getFieldError, handleSubmit } = useAuthForm<RegistrationFormData>({
  formRef,
})

const phoneError = computed(() => getFieldError('phone'))

const state = reactive({
  name: '',
  password: '',
  countryCode: '',
  dialCode: '',
  phone: '',
})

const selectedCountry = computed(() => {
  const country = countries.value.find(c => c.code === state.countryCode)
  return country ? { code: country.code, name: country.name } : undefined
})

const phoneSchema = usePhoneSchema(selectedCountry)

const registrationSchema = computed(() => {
  const baseSchema = z.object({
    name: z.string().min(
      FIELD_CONSTRAINTS.NAME_MIN_LENGTH,
      VALIDATION_MESSAGES.NAME_MIN_LENGTH
    ),
    password: z.string()
      .min(FIELD_CONSTRAINTS.PASSWORD_MIN_LENGTH, VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH)
      .regex(PASSWORD_REGEX.LOWERCASE, VALIDATION_MESSAGES.PASSWORD_LOWERCASE)
      .regex(PASSWORD_REGEX.UPPERCASE, VALIDATION_MESSAGES.PASSWORD_UPPERCASE)
      .regex(PASSWORD_REGEX.NUMBER, VALIDATION_MESSAGES.PASSWORD_NUMBER)
      .regex(PASSWORD_REGEX.SPECIAL, VALIDATION_MESSAGES.PASSWORD_SPECIAL),
  })

  return z.intersection(baseSchema, phoneSchema.value)
})

type RegistrationFormData = z.infer<typeof registrationSchema.value>

/**
 * Handles form submission - validates data, registers user, and navigates to profile completion
 */
async function handleFormSubmit(event: FormSubmitEvent<RegistrationFormData>): Promise<void> {
  await handleSubmit(async () => {
    const { name, password, dialCode, phone, countryCode } = event.data

    // Register user with validated and formatted data
    await register({
      name,
      phone: normalizePhone(dialCode, phone),
      phone_country: countryCode,
      phone_country_code: dialCode,
      password,
    })

    // Navigate to profile completion page on successful registration
    await navigateTo(ROUTES.COMPLETE_PROFILE)
  })
}
</script>

<template>
  <main>
    <!-- General error alert - displayed at top of form when registration fails -->
    <UAlert
v-if="generalErrorMessage" :description="generalErrorMessage" color="error" variant="soft"
      title="Registration Failed" class="mb-4" icon="i-lucide-alert-circle" />

    <!-- Registration form with Zod validation -->
    <UForm ref="formRef" :schema="registrationSchema" :state="state" class="space-y-3" @submit="handleFormSubmit">
      <!-- Full name input field -->
      <UFormField label="Full Name" name="name" required>
        <UInput v-model="state.name" class="w-full" size="lg" icon="i-lucide-user" placeholder="John Doe" />
      </UFormField>

      <!-- Country phone input component - handles country code, dial code, and phone number -->
      <FormsCountryPhoneInput
v-model:country-code="state.countryCode" v-model:dial-code="state.dialCode"
        v-model:phone="state.phone" :error="phoneError" />

      <!-- Password input field with strength requirements -->
      <UFormField label="Password" name="password" required>
        <UInput
v-model="state.password" class="w-full" size="lg" icon="i-lucide-lock" type="password"
          placeholder="********" />
      </UFormField>

      <!-- Submit button - disabled until form is valid -->
      <UButton
:loading="isProcessing" type="submit" size="xl" icon="i-lucide-send"
        class="w-full justify-center disabled:bg-primary-400">
        Sign Up
      </UButton>
    </UForm>

    <!-- Link to login page for existing users -->
    <UButton
:to="ROUTES.LOGIN" class="mt-3 underline font-bold px-0" variant="link"
      trailing-icon="i-lucide-arrow-right" size="xl">
      Have an Account? Log In
    </UButton>
  </main>
</template>