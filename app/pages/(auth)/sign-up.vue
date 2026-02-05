<script setup lang="ts">

import { z } from 'zod'
import { computed, reactive, ref } from 'vue'
import { navigateTo } from 'nuxt/app'
import { normalizePhone, usePhoneSchema } from '~/composables/usePhoneSchema'
import { useCountries } from '~/composables/useCountries'
import { useAuthForm } from '~/composables/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'
import SocialAuth from "~/components/social-auth.vue";

definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

// Keeping minimal Zod validation for form submission safety
const MIN_PASSWORD_LENGTH = 8

const ROUTES = {
  COMPLETE_PROFILE: '/complete-profile-data',
  LOGIN: '/log-in',
} as const

const { register } = useAuth()
const { countries } = useCountries()

const formRef = ref<Form<RegistrationFormData> | null>(null)

const { isSubmitting: isProcessing, generalError: generalErrorMessage, getFieldError, handleSubmit } = useAuthForm({
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
    name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(MIN_PASSWORD_LENGTH, 'Must be at least 8 characters'),
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
      country: countryCode,
      password,
    })

    // Navigate to profile completion page on successful registration
    await navigateTo(ROUTES.COMPLETE_PROFILE)
  })
}
</script>

<template>
  <main>

    <SocialAuth />

    <USeparator color="primary" class="my-4" label="OR" />
    <!-- General error alert - displayed at top of form when registration fails -->
    <UAlert
      v-if="generalErrorMessage" :description="generalErrorMessage" color="error" variant="soft"
      title="Registration Failed" class="mb-4" icon="i-lucide-alert-circle"
    />

    <!-- Registration form with Zod validation -->
    <UForm ref="formRef" :schema="registrationSchema" :state="state" class="space-y-3" @submit="handleFormSubmit">
      <!-- Full name input field -->
      <UFormField label="Full Name" name="name" required>
        <UInput v-model="state.name" class="w-full" size="lg" icon="i-lucide-user" placeholder="John Doe" />
      </UFormField>

      <!-- Country phone input component - handles country code, dial code, and phone number -->
      <FormsCountryPhoneInput
        v-model:country-code="state.countryCode" v-model:dial-code="state.dialCode"
        v-model:phone="state.phone" :error="phoneError"
      />

      <!-- Password input field with strength requirements -->
      <UFormField label="Password" name="password" required>
        <FormsPasswordInput
          v-model="state.password"
          placeholder="********"
        />
      </UFormField>

      <!-- Submit button - disabled until form is valid -->
      <UButton
        :loading="isProcessing" type="submit" size="xl" icon="i-lucide-send"
        class="w-full justify-center disabled:bg-primary-400"
      >
        Sign Up
      </UButton>
    </UForm>

    <!-- Link to login page for existing users -->
    <UButton
      :to="ROUTES.LOGIN" class="mt-3 underline font-bold px-0" variant="link"
      trailing-icon="i-lucide-arrow-right" size="xl"
    >
      Have an Account? Log In
    </UButton>
  </main>
</template>